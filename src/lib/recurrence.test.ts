import { describe, expect, it } from 'vitest'
import { ruleOccurrences, emailSubject, describeRule, occurrencesInRange, type Calendar } from './recurrence'
import { DEFAULT_HOLIDAYS } from './holidays'
import type { Item } from './types'

const cal: Calendar = { holidays: new Set(DEFAULT_HOLIDAYS.map((h) => h.date)), workDays: [1, 2, 3, 4, 5] }
const dates = (r: { date: string }[]) => r.map((o) => o.date)

describe('reglas', () => {
  it('semanal: todos los viernes', () => {
    expect(dates(ruleOccurrences({ type: 'weekly', days: [5] }, '2026-11-26', '2026-12-12', cal)))
      .toEqual(['2026-11-27', '2026-12-04', '2026-12-11'])
  })

  it('semanal: si cae feriado se adelanta al día hábil anterior', () => {
    // Martes 8/12/2026 es feriado y el lunes 7/12 es puente → viernes 4/12
    const r = ruleOccurrences({ type: 'weekly', days: [2] }, '2026-12-01', '2026-12-10', cal)
    expect(r).toEqual([
      { key: '2026-12-01', date: '2026-12-01' },
      { key: '2026-12-08', date: '2026-12-04' },
    ])
  })

  it('primer día hábil del mes saltea feriados y fines de semana', () => {
    // 1/1/2027 es feriado (viernes) → primer día hábil lunes 4/1
    expect(dates(ruleOccurrences({ type: 'businessDay', n: 1 }, '2026-12-01', '2027-01-31', cal)))
      .toEqual(['2026-12-01', '2027-01-04'])
  })

  it('tercer día hábil del mes', () => {
    // Diciembre 2026: 1 (ma), 2 (mi), 3 (ju)
    expect(dates(ruleOccurrences({ type: 'businessDay', n: 3 }, '2026-12-01', '2026-12-31', cal))).toEqual(['2026-12-03'])
  })

  it('último día hábil del mes', () => {
    // Nov 2026: lunes 30. Ene 2027: viernes 29.
    expect(dates(ruleOccurrences({ type: 'businessDay', n: -1 }, '2026-11-01', '2027-01-31', cal)))
      .toEqual(['2026-11-30', '2026-12-31', '2027-01-29'])
  })

  it('primer martes del mes', () => {
    expect(dates(ruleOccurrences({ type: 'nthWeekday', n: 1, weekday: 2 }, '2026-12-01', '2027-01-31', cal)))
      .toEqual(['2026-12-01', '2027-01-05'])
  })

  it('día fijo que cae en fin de semana se adelanta', () => {
    // 5/12/2026 es sábado → viernes 4/12
    expect(dates(ruleOccurrences({ type: 'monthDay', day: 5 }, '2026-12-01', '2026-12-31', cal))).toEqual(['2026-12-04'])
  })
})

describe('asunto automático', () => {
  const base: Item = {
    id: 'x', kind: 'report', title: 'Informe de consultorios externos', to: [], cc: [],
    subjectPeriod: 'prevMonth', rule: { type: 'businessDay', n: 1 }, priority: 'normal',
    remindDayBefore: false, active: true, createdAt: '2026-01-01',
  }
  it('mes anterior', () => {
    expect(emailSubject(base, '2026-12-01')).toBe('Informe de consultorios externos – Noviembre 2026')
    expect(emailSubject(base, '2027-01-04')).toBe('Informe de consultorios externos – Diciembre 2026')
  })
  it('fecha', () => {
    expect(emailSubject({ ...base, title: 'Facturas bloqueadas', subjectPeriod: 'date' }, '2026-12-01')).toBe('Facturas bloqueadas – 01/12/2026')
  })
})

describe('descripciones', () => {
  it('texto legible', () => {
    expect(describeRule({ type: 'weekly', days: [3] })).toBe('Todos los miércoles')
    expect(describeRule({ type: 'businessDay', n: 3 })).toBe('Tercer día hábil de cada mes')
    expect(describeRule({ type: 'businessDay', n: -1 })).toBe('Último día hábil de cada mes')
  })
})

describe('cambios puntuales', () => {
  const item: Item = {
    id: 'a', kind: 'report', title: 'X', to: [], cc: [], subjectPeriod: 'date',
    rule: { type: 'weekly', days: [5] }, priority: 'normal', remindDayBefore: false, active: true, createdAt: '2026-11-01',
  }
  it('mover y saltear', () => {
    const occ = occurrencesInRange([item], '2026-11-26', '2026-12-12', cal, [{ itemId: 'a', date: '2026-12-04', doneAt: '' }], [
      { itemId: 'a', date: '2026-11-27', movedTo: '2026-11-30' },
      { itemId: 'a', date: '2026-12-11', skipped: true },
    ])
    expect(occ.map((o) => [o.date, o.done, o.moved])).toEqual([
      ['2026-11-30', false, true],
      ['2026-12-04', true, false],
    ])
  })
})

describe('reuniones', () => {
  const meeting: Item = {
    id: 'm', kind: 'meeting', title: 'Reunión de gerencia', to: [], cc: [], subjectPeriod: 'date',
    rule: { type: 'weekly', days: [2] }, time: '10:00', priority: 'normal', remindDayBefore: false, active: true, createdAt: '2026-11-01',
  }
  it('no se adelantan si caen feriado', () => {
    const occ = occurrencesInRange([meeting], '2026-12-01', '2026-12-10', cal, [], [])
    expect(occ.map((o) => o.date)).toEqual(['2026-12-01', '2026-12-08'])
  })
  it('lo que tiene hora va primero en el día', () => {
    const task: Item = { ...meeting, id: 't', kind: 'task', time: undefined, rule: { type: 'once', date: '2026-12-01' } }
    const occ = occurrencesInRange([task, meeting], '2026-12-01', '2026-12-01', cal, [], [])
    expect(occ.map((o) => o.item.id)).toEqual(['m', 't'])
  })
})
