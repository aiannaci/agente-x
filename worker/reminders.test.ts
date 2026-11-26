import { describe, expect, it } from 'vitest'
import { dueNotifications, localNow, type UserData } from './reminders'
import { DEFAULT_HOLIDAYS } from '../src/lib/holidays'
import type { Item } from '../src/lib/types'

const base = { to: [] as string[], cc: [] as string[], subjectPeriod: 'date' as const, priority: 'normal' as const, remindDayBefore: false, active: true, createdAt: '2026-12-01' }
const report: Item = { ...base, id: 'r', kind: 'report', title: 'Facturas bloqueadas', to: ['a@b.com'], rule: { type: 'weekly', days: [2] } }
const meeting: Item = { ...base, id: 'm', kind: 'meeting', title: 'Gerencia', rule: { type: 'weekly', days: [2] }, time: '10:00', endTime: '11:00', remindMinutes: 15, location: 'https://meet.google.com/x' }

const data = (items: Item[], extra: Partial<UserData> = {}): UserData => ({
  items, completions: [], overrides: [], holidays: DEFAULT_HOLIDAYS,
  settings: { workStart: '08:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5] }, ...extra,
})
const at = (h: number, m = 0) => h * 60 + m
const titles = (d: ReturnType<typeof dueNotifications>) => d.map((x) => x.payload.title)

describe('avisos', () => {
  // Martes 1/12/2026
  it('8:15 aviso del día con acciones', () => {
    const d = dueNotifications(data([report]), '2026-12-01', at(8, 15))
    expect(titles(d)).toEqual(['Hoy te toca enviar'])
    expect(d[0].payload.actions.map((a) => a.action)).toEqual(['done', 'mail'])
  })
  it('antes de las 8:15 no avisa', () => {
    expect(dueNotifications(data([report]), '2026-12-01', at(8, 10))).toEqual([])
  })
  it('13:00 y 16:00 solo si sigue pendiente', () => {
    expect(titles(dueNotifications(data([report]), '2026-12-01', at(13, 2)))).toEqual(['Todavía pendiente'])
    expect(titles(dueNotifications(data([report]), '2026-12-01', at(16, 0)))).toEqual(['Último aviso del día'])
    const done = data([report], { completions: [{ itemId: 'r', date: '2026-12-01', doneAt: '' }] })
    expect(dueNotifications(done, '2026-12-01', at(13, 0))).toEqual([])
  })
  it('atrasados se avisan a la mañana siguiente', () => {
    const d = dueNotifications(data([report]), '2026-12-02', at(8, 20))
    expect(titles(d)).toEqual(['Atrasado desde el 01/12'])
  })
  it('varios atrasados llegan agrupados en un solo aviso', () => {
    const old = { ...report, createdAt: '2026-11-01' }
    const d = dueNotifications(data([old]), '2026-12-02', at(8, 15))
    expect(titles(d)).toEqual(['Tenés 5 pendientes atrasados'])
    expect(dueNotifications(data([old]), '2026-12-02', at(13, 0))).toEqual([])
  })
  it('reunión 15 minutos antes, con botón Unirme', () => {
    expect(dueNotifications(data([meeting]), '2026-12-01', at(9, 40))).toEqual([])
    const d = dueNotifications(data([meeting]), '2026-12-01', at(9, 45))
    expect(titles(d)).toEqual(['En 15 min: Gerencia'])
    expect(d[0].payload.body).toBe('10:00 a 11:00')
    expect(d[0].payload.actions[0].action).toBe('join')
    expect(dueNotifications(data([meeting]), '2026-12-01', at(10, 0))).toEqual([])
    expect(titles(dueNotifications(data([meeting]), '2026-12-01', at(9, 52)))).toEqual(['En 8 min: Gerencia'])
  })
  it('feriado: sin avisos de informes (8/12) pero sí de reuniones', () => {
    // El informe del martes 8/12 se adelantó al viernes 4/12.
    expect(titles(dueNotifications(data([report, meeting]), '2026-12-08', at(9, 50)))).toEqual(['En 10 min: Gerencia'])
    const doneFirst = data([report], { completions: [{ itemId: 'r', date: '2026-12-01', doneAt: '' }] })
    expect(titles(dueNotifications(doneFirst, '2026-12-04', at(8, 15)))).toEqual(['Hoy te toca enviar'])
  })
  it('aviso el día hábil anterior', () => {
    const r = { ...report, remindDayBefore: true }
    expect(titles(dueNotifications(data([r]), '2026-11-30', at(16, 30)))).toEqual(['Mañana te toca enviar'])
  })
  it('las claves no se repiten entre avisos del mismo día', () => {
    const keys = [at(8, 15), at(13, 0), at(16, 0)].flatMap((m) => dueNotifications(data([report]), '2026-12-01', m).map((d) => d.logKey))
    expect(new Set(keys).size).toBe(3)
  })
})

describe('hora local', () => {
  it('Buenos Aires es UTC-3', () => {
    expect(localNow('America/Argentina/Buenos_Aires', new Date('2026-12-01T11:15:00Z'))).toEqual({ date: '2026-12-01', minutes: at(8, 15), label: '08:15' })
  })
})
