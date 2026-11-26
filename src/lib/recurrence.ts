import { addDays, daysInMonth, fromISO, weekday, ymd, WEEKDAYS, MONTHS, cap } from './dates'
import type { ISODate, Item, Rule, Completion, Override, Occurrence } from './types'

export interface Calendar {
  holidays: Set<ISODate>
  workDays: number[]
}

export function isBusinessDay(d: ISODate, cal: Calendar): boolean {
  return cal.workDays.includes(weekday(d)) && !cal.holidays.has(d)
}

/** Si el día no es hábil, retrocede hasta el día hábil anterior. */
export function previousBusinessDay(d: ISODate, cal: Calendar): ISODate {
  let cur = d
  for (let i = 0; i < 30 && !isBusinessDay(cur, cal); i++) cur = addDays(cur, -1)
  return cur
}

function businessDaysOfMonth(year: number, month0: number, cal: Calendar): ISODate[] {
  const out: ISODate[] = []
  for (let day = 1; day <= daysInMonth(year, month0); day++) {
    const d = ymd(year, month0, day)
    if (isBusinessDay(d, cal)) out.push(d)
  }
  return out
}

/** Fecha nominal de la regla en un mes dado (sin ajustar por feriados), o null. */
function monthlyDate(rule: Rule, year: number, month0: number, cal: Calendar): ISODate | null {
  switch (rule.type) {
    case 'monthDay': {
      const last = daysInMonth(year, month0)
      const day = rule.day === 'last' ? last : Math.min(rule.day, last)
      return ymd(year, month0, day)
    }
    case 'businessDay': {
      const days = businessDaysOfMonth(year, month0, cal)
      const idx = rule.n > 0 ? rule.n - 1 : days.length + rule.n
      return days[idx] ?? null
    }
    case 'nthWeekday': {
      const matches: ISODate[] = []
      for (let day = 1; day <= daysInMonth(year, month0); day++) {
        const d = ymd(year, month0, day)
        if (weekday(d) === rule.weekday) matches.push(d)
      }
      const idx = rule.n > 0 ? rule.n - 1 : matches.length + rule.n
      return matches[idx] ?? null
    }
    default:
      return null
  }
}

/**
 * Ocurrencias de una regla entre `from` y `to` (inclusive), por fecha efectiva.
 * Devuelve pares { key, date }: `key` es la fecha nominal y `date` la ajustada al día
 * hábil anterior cuando la nominal cae feriado o fin de semana.
 */
export function ruleOccurrences(rule: Rule, from: ISODate, to: ISODate, cal: Calendar, shift = true): { key: ISODate; date: ISODate }[] {
  const adjust = (d: ISODate) => (shift ? previousBusinessDay(d, cal) : d)
  const out: { key: ISODate; date: ISODate }[] = []
  // Ampliamos el rango de búsqueda: un ajuste puede mover la fecha hacia atrás.
  const scanFrom = addDays(from, -1)
  const scanTo = addDays(to, 14)

  if (rule.type === 'once') {
    out.push({ key: rule.date, date: rule.date })
  } else if (rule.type === 'weekly') {
    for (let d = scanFrom; d <= scanTo; d = addDays(d, 1)) {
      if (rule.days.includes(weekday(d))) out.push({ key: d, date: adjust(d) })
    }
  } else {
    const start = fromISO(scanFrom)
    const end = fromISO(scanTo)
    let y = start.getFullYear()
    let m = start.getMonth()
    while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
      const d = monthlyDate(rule, y, m, cal)
      if (d) out.push({ key: d, date: adjust(d) })
      m++
      if (m > 11) { m = 0; y++ }
    }
  }
  return out.filter((o) => o.date >= from && o.date <= to)
}

/** Ocurrencias de todos los elementos en un rango, aplicando cambios puntuales y estado hecho. */
export function occurrencesInRange(
  items: Item[],
  from: ISODate,
  to: ISODate,
  cal: Calendar,
  completions: Completion[],
  overrides: Override[],
): Occurrence[] {
  const doneSet = new Set(completions.map((c) => `${c.itemId}|${c.date}`))
  const ovMap = new Map(overrides.map((o) => [`${o.itemId}|${o.date}`, o]))
  const out: Occurrence[] = []

  for (const item of items) {
    if (!item.active || !item.rule) continue
    // Buscamos un poco más allá del rango para detectar ocurrencias movidas hacia adentro.
    // Las reuniones no se adelantan por feriados: se muestran con aviso.
    const raw = ruleOccurrences(item.rule, addDays(from, -45), addDays(to, 45), cal, item.kind !== 'meeting')
    for (const { key, date } of raw) {
      const ov = ovMap.get(`${item.id}|${key}`)
      if (ov?.skipped) continue
      const eff = ov?.movedTo ?? date
      if (eff < from || eff > to) continue
      if (key < item.createdAt && eff < item.createdAt) continue
      out.push({ item, key, date: eff, done: doneSet.has(`${item.id}|${key}`), moved: !!ov?.movedTo })
    }
  }
  // Por fecha; dentro del día, primero lo que tiene hora (en orden) y después el resto.
  return out.sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : (a.item.time ?? '99:99').localeCompare(b.item.time ?? '99:99')))
}

/** Asunto automático del email. */
export function emailSubject(item: Item, occurrenceDate: ISODate): string {
  const d = fromISO(occurrenceDate)
  if (item.subjectPeriod === 'date') {
    const [y, m, dd] = occurrenceDate.split('-')
    return `${item.title} – ${dd}/${m}/${y}`
  }
  if (item.subjectPeriod === 'prevMonth') d.setMonth(d.getMonth() - 1, 1)
  return `${item.title} – ${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`
}

/** Período de asunto sugerido según la regla. */
export function defaultSubjectPeriod(rule: Rule | null): Item['subjectPeriod'] {
  if (!rule) return 'date'
  if (rule.type === 'businessDay') return rule.n > 0 && rule.n <= 10 ? 'prevMonth' : 'currentMonth'
  if (rule.type === 'monthDay') return rule.day !== 'last' && rule.day <= 10 ? 'prevMonth' : 'currentMonth'
  if (rule.type === 'nthWeekday') return rule.n > 0 && rule.n <= 2 ? 'prevMonth' : 'currentMonth'
  return 'date'
}

const ORD = ['', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto']
const ordinal = (n: number) => (n === -1 ? 'último' : n === -2 ? 'anteúltimo' : ORD[n] ?? `${n}º`)

/** Descripción legible de una regla. */
export function describeRule(rule: Rule | null): string {
  if (!rule) return 'Sin fecha'
  switch (rule.type) {
    case 'once': {
      const [y, m, d] = rule.date.split('-')
      return `El ${d}/${m}/${y}`
    }
    case 'weekly': {
      const sorted = [...rule.days].sort()
      if (sorted.join() === '1,2,3,4,5') return 'De lunes a viernes'
      const days = sorted.map((d) => WEEKDAYS[d - 1].replace(/^sábado$/, 'sábados').replace(/^domingo$/, 'domingos'))
      const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} y ${days.at(-1)}` : days[0]
      return `Todos los ${list}`
    }
    case 'monthDay':
      return rule.day === 'last' ? 'Último día de cada mes' : `El día ${rule.day} de cada mes`
    case 'businessDay':
      return `${cap(ordinal(rule.n))} día hábil de cada mes`
    case 'nthWeekday':
      return `${cap(ordinal(rule.n))} ${WEEKDAYS[rule.weekday - 1]} de cada mes`
  }
}
