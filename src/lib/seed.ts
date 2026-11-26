import type { Item } from './types'
import { todayISO } from './dates'

const ASI_TO = ['fabian.arrigoni@asi.com.ar', 'asigerenciacomercial@gmail.com', 'javier.garcia@asi.com.ar', 'sandra.elias@asi.com.ar']
const ASI_CC = ['hfranconieri@gmail.com', 'gncelano@gmail.com']

type Seed = Pick<Item, 'title' | 'to' | 'cc' | 'rule' | 'subjectPeriod'>

/** Informes del Excel original. */
const REPORTS: Seed[] = [
  { title: 'Reporte de producción de vendedores ASI semanal', rule: { type: 'weekly', days: [5] }, to: ASI_TO, cc: ASI_CC, subjectPeriod: 'date' },
  { title: 'Reporte de producción de vendedores ASI mensual', rule: { type: 'businessDay', n: 1 }, to: ASI_TO, cc: ASI_CC, subjectPeriod: 'prevMonth' },
  { title: 'Informe de consultorios externos', rule: { type: 'businessDay', n: 1 }, to: ['echilelli@sanatoriomodelo.com.ar'], cc: ['gncelano@gmail.com'], subjectPeriod: 'prevMonth' },
  { title: 'Facturas bloqueadas', rule: { type: 'weekly', days: [2] }, to: ['alejandro.irastorza@asi.com.ar', 'javier.garcia@asi.com.ar', 'analia.gonzalez@asi.com.ar'], cc: [], subjectPeriod: 'date' },
  { title: 'Informe de compras SMC', rule: { type: 'weekly', days: [3] }, to: ['dgarcia@sanatoriomodelo.com.ar'], cc: [], subjectPeriod: 'date' },
  { title: 'Informe de alto costo ASI - OSEPJANA', rule: { type: 'weekly', days: [3] }, to: ['dgarcia@sanatoriomodelo.com.ar'], cc: [], subjectPeriod: 'date' },
  { title: 'Informe para la cámara de prestadores', rule: { type: 'businessDay', n: -1 }, to: ['mdominguez@sanatoriomodelo.com.ar'], cc: [], subjectPeriod: 'currentMonth' },
]

export function newId(): string {
  return crypto.randomUUID()
}

export function seedReports(): Item[] {
  const today = todayISO()
  return REPORTS.map((r) => ({
    ...r,
    id: newId(),
    kind: 'report',
    priority: 'normal',
    remindDayBefore: false,
    active: true,
    createdAt: today,
  }))
}

export const SEED_COUNT = REPORTS.length
