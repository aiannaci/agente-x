import type { ISODate } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** 1 = lunes … 7 = domingo */
export function weekday(s: ISODate): number {
  const w = fromISO(s).getDay()
  return w === 0 ? 7 : w
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

export function ymd(year: number, month0: number, day: number): ISODate {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`
}

export const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export const WEEKDAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "26/11/2026" */
export function formatShort(s: ISODate): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

/** "jueves 26/11" */
export function formatDayLabel(s: ISODate): string {
  const [, m, d] = s.split('-')
  return `${WEEKDAYS[weekday(s) - 1]} ${Number(d)}/${Number(m)}`
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000)
}
