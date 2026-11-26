import type { Holiday } from './types'

/**
 * Feriados nacionales de Argentina y días no laborables con fines turísticos ("puentes").
 * La lista es editable desde Ajustes. Los puentes de 2027 todavía no están decretados.
 */
export const DEFAULT_HOLIDAYS: Holiday[] = [
  // 2026
  { date: '2026-01-01', name: 'Año Nuevo', kind: 'feriado' },
  { date: '2026-02-16', name: 'Carnaval', kind: 'feriado' },
  { date: '2026-02-17', name: 'Carnaval', kind: 'feriado' },
  { date: '2026-03-23', name: 'Día no laborable (puente)', kind: 'puente' },
  { date: '2026-03-24', name: 'Día de la Memoria por la Verdad y la Justicia', kind: 'feriado' },
  { date: '2026-04-02', name: 'Día del Veterano y de los Caídos en Malvinas / Jueves Santo', kind: 'feriado' },
  { date: '2026-04-03', name: 'Viernes Santo', kind: 'feriado' },
  { date: '2026-05-01', name: 'Día del Trabajador', kind: 'feriado' },
  { date: '2026-05-25', name: 'Día de la Revolución de Mayo', kind: 'feriado' },
  { date: '2026-06-15', name: 'Paso a la Inmortalidad del Gral. Güemes', kind: 'feriado' },
  { date: '2026-06-20', name: 'Paso a la Inmortalidad del Gral. Belgrano', kind: 'feriado' },
  { date: '2026-07-09', name: 'Día de la Independencia', kind: 'feriado' },
  { date: '2026-07-10', name: 'Día no laborable (puente)', kind: 'puente' },
  { date: '2026-08-17', name: 'Paso a la Inmortalidad del Gral. San Martín', kind: 'feriado' },
  { date: '2026-10-12', name: 'Día del Respeto a la Diversidad Cultural', kind: 'feriado' },
  { date: '2026-11-23', name: 'Día de la Soberanía Nacional', kind: 'feriado' },
  { date: '2026-12-07', name: 'Día no laborable (puente)', kind: 'puente' },
  { date: '2026-12-08', name: 'Inmaculada Concepción de María', kind: 'feriado' },
  { date: '2026-12-25', name: 'Navidad', kind: 'feriado' },
  // 2027
  { date: '2027-01-01', name: 'Año Nuevo', kind: 'feriado' },
  { date: '2027-02-08', name: 'Carnaval', kind: 'feriado' },
  { date: '2027-02-09', name: 'Carnaval', kind: 'feriado' },
  { date: '2027-03-24', name: 'Día de la Memoria por la Verdad y la Justicia', kind: 'feriado' },
  { date: '2027-03-25', name: 'Jueves Santo', kind: 'feriado' },
  { date: '2027-03-26', name: 'Viernes Santo', kind: 'feriado' },
  { date: '2027-04-02', name: 'Día del Veterano y de los Caídos en Malvinas', kind: 'feriado' },
  { date: '2027-05-01', name: 'Día del Trabajador', kind: 'feriado' },
  { date: '2027-05-25', name: 'Día de la Revolución de Mayo', kind: 'feriado' },
  { date: '2027-06-20', name: 'Paso a la Inmortalidad del Gral. Belgrano', kind: 'feriado' },
  { date: '2027-06-21', name: 'Paso a la Inmortalidad del Gral. Güemes', kind: 'feriado' },
  { date: '2027-07-09', name: 'Día de la Independencia', kind: 'feriado' },
  { date: '2027-08-16', name: 'Paso a la Inmortalidad del Gral. San Martín', kind: 'feriado' },
  { date: '2027-10-11', name: 'Día del Respeto a la Diversidad Cultural', kind: 'feriado' },
  { date: '2027-11-20', name: 'Día de la Soberanía Nacional', kind: 'feriado' },
  { date: '2027-12-08', name: 'Inmaculada Concepción de María', kind: 'feriado' },
  { date: '2027-12-25', name: 'Navidad', kind: 'feriado' },
]
