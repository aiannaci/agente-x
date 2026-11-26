import { occurrencesInRange, isBusinessDay, type Calendar } from '../src/lib/recurrence'
import { addDays, formatShort } from '../src/lib/dates'
import type { Completion, Holiday, ISODate, Item, Occurrence, Override, Settings } from '../src/lib/types'

export interface UserData {
  items: Item[]
  completions: Completion[]
  overrides: Override[]
  holidays: Holiday[]
  settings: Settings
}

export interface NotificationPayload {
  title: string
  body: string
  tag: string
  itemId: string
  /** Clave de la ocurrencia (para marcar como hecho). */
  key: string
  /** Fecha efectiva (para el asunto del email). */
  date: string
  kind: Item['kind']
  actions: { action: 'done' | 'mail' | 'join'; title: string }[]
  joinUrl?: string
}

export interface Due {
  /** Identificador único del aviso, para no repetirlo. */
  logKey: string
  payload: NotificationPayload
}

/** Ventana durante la que un aviso programado todavía se puede mandar (por si el servidor se demora). */
const WINDOW = 60

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const inWindow = (now: number, slot: number, end = slot + WINDOW) => now >= slot && now < end
const shortDate = (d: ISODate) => formatShort(d).slice(0, 5)

function baseActions(item: Item): NotificationPayload['actions'] {
  const a: NotificationPayload['actions'] = [{ action: 'done', title: 'Marcar como hecho' }]
  if (item.kind === 'report' && item.to.length) a.push({ action: 'mail', title: 'Preparar email' })
  return a
}

function payload(o: Occurrence, title: string, body: string): NotificationPayload {
  return {
    title, body,
    tag: `${o.item.id}|${o.key}`,
    itemId: o.item.id,
    key: String(o.key),
    date: o.date!,
    kind: o.item.kind,
    actions: baseActions(o.item),
  }
}

/** Horarios de aviso del día laboral, según el horario de cada usuario. */
export function slots(settings: Settings) {
  const start = toMin(settings.workStart)
  const end = toMin(settings.workEnd)
  const clamp = (m: number) => Math.min(Math.max(m, start), end - 1)
  return {
    morning: clamp(start + 15), // 08:15
    mid: clamp(13 * 60), // 13:00
    last: clamp(end - 60), // 16:00
    dayBefore: clamp(end - 30), // 16:30
  }
}

/** Avisos que corresponde mandar en este momento (hora local del usuario). */
export function dueNotifications(data: UserData, today: ISODate, nowMin: number): Due[] {
  const cal: Calendar = { holidays: new Set(data.holidays.map((h) => h.date)), workDays: data.settings.workDays }
  const out: Due[] = []
  const all = occurrencesInRange(data.items, addDays(today, -60), addDays(today, 10), cal, data.completions, data.overrides)
  const todays = all.filter((o) => o.date === today)
  const tasksAndReports = (o: Occurrence) => o.item.kind !== 'meeting'

  // Reuniones: X minutos antes del inicio, cualquier día.
  for (const o of todays.filter((o) => o.item.kind === 'meeting' && o.item.time)) {
    const remind = o.item.remindMinutes ?? 15
    if (remind <= 0) continue
    const start = toMin(o.item.time!)
    if (inWindow(nowMin, start - remind, start)) {
      const left = start - nowMin // minutos que faltan de verdad (el aviso puede salir unos minutos tarde)
      const when = left >= 60 ? `En ${Math.floor(left / 60)} h${left % 60 ? ` ${left % 60} min` : ''}` : `En ${left} min`
      const place = o.item.location && !/^https?:\/\//i.test(o.item.location) ? ` · ${o.item.location}` : ''
      out.push({
        logKey: `${o.item.id}|${o.key}|meeting`,
        payload: {
          ...payload(o, `${when}: ${o.item.title}`, `${o.item.time}${o.item.endTime ? ` a ${o.item.endTime}` : ''}${place}`),
          actions: o.item.location && /^https?:\/\//i.test(o.item.location) ? [{ action: 'join', title: 'Unirme' }] : [],
          joinUrl: o.item.location && /^https?:\/\//i.test(o.item.location) ? o.item.location.trim() : undefined,
        },
      })
    }
  }

  // Tareas con hora: aviso a esa hora.
  for (const o of todays.filter((o) => o.item.kind === 'task' && o.item.time && !o.done)) {
    if (inWindow(nowMin, toMin(o.item.time!))) {
      out.push({ logKey: `${o.item.id}|${o.key}|time`, payload: payload(o, `Ahora: ${o.item.title}`, `Tarea de las ${o.item.time}`) })
    }
  }

  // Informes y tareas: solo en días hábiles y dentro del horario laboral.
  if (!isBusinessDay(today, cal)) return out
  const s = slots(data.settings)
  const pendingToday = todays.filter((o) => tasksAndReports(o) && !o.done)
  const overdue = all.filter((o) => tasksAndReports(o) && !o.done && o.date! < today)
  const verb = (o: Occurrence) => (o.item.kind === 'report' ? 'enviar' : 'hacer')

  if (inWindow(nowMin, s.morning)) {
    for (const o of pendingToday) {
      out.push({ logKey: `${o.item.id}|${o.key}|morning|${today}`, payload: payload(o, `Hoy te toca ${verb(o)}`, o.item.title) })
    }
    // Atrasados: uno solo por la mañana; si son varios, agrupados en un aviso.
    if (overdue.length === 1) {
      const o = overdue[0]
      out.push({ logKey: `${o.item.id}|${o.key}|overdue|${today}`, payload: payload(o, `Atrasado desde el ${shortDate(o.date!)}`, o.item.title) })
    } else if (overdue.length > 1) {
      const names = [...new Set(overdue.map((o) => o.item.title))]
      out.push({
        logKey: `overdue-summary|${today}`,
        payload: {
          title: `Tenés ${overdue.length} pendientes atrasados`,
          body: names.slice(0, 4).join(' · ') + (names.length > 4 ? ` y ${names.length - 4} más` : ''),
          tag: `overdue|${today}`, itemId: '', key: '', date: today, kind: 'task', actions: [],
        },
      })
    }
  }

  // Insistencia a las 13:00 y 16:00: solo lo que vence hoy y sigue pendiente.
  for (const [slot, name, title] of [[s.mid, 'mid', 'Todavía pendiente'], [s.last, 'last', 'Último aviso del día']] as const) {
    if (!inWindow(nowMin, slot) || slot <= s.morning) continue
    for (const o of pendingToday) {
      out.push({ logKey: `${o.item.id}|${o.key}|${name}|${today}`, payload: payload(o, title, o.item.title) })
    }
  }

  // Aviso el día hábil anterior (para informes que llevan preparación).
  if (inWindow(nowMin, s.dayBefore)) {
    let next = addDays(today, 1)
    for (let i = 0; i < 10 && !isBusinessDay(next, cal); i++) next = addDays(next, 1)
    for (const o of all.filter((o) => o.date === next && o.item.remindDayBefore && !o.done && tasksAndReports(o))) {
      const label = next === addDays(today, 1) ? 'Mañana' : `El ${shortDate(next)}`
      out.push({ logKey: `${o.item.id}|${o.key}|daybefore`, payload: payload(o, `${label} te toca ${verb(o)}`, o.item.title) })
    }
  }

  return out
}

/** Fecha y minutos actuales en la zona horaria del usuario. */
export function localNow(timeZone: string, at = new Date()): { date: ISODate; minutes: number; label: string } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at)
  } catch {
    return localNow('America/Argentina/Buenos_Aires', at)
  }
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes, label: fmt(minutes) }
}
