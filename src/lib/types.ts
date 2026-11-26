/** Fecha local en formato 'YYYY-MM-DD'. */
export type ISODate = string

export type Rule =
  /** Días de la semana (1 = lunes … 7 = domingo). */
  | { type: 'weekly'; days: number[] }
  /** Un día fijo del mes (1–31) o el último día del mes. */
  | { type: 'monthDay'; day: number | 'last' }
  /** N-ésimo día hábil del mes. `n` negativo cuenta desde el final (-1 = último). */
  | { type: 'businessDay'; n: number }
  /** N-ésimo día de la semana del mes (ej. primer martes). `n` = -1 es el último. */
  | { type: 'nthWeekday'; n: number; weekday: number }
  /** Una sola vez. */
  | { type: 'once'; date: ISODate }

export type SubjectPeriod = 'date' | 'prevMonth' | 'currentMonth'

export interface Item {
  id: string
  kind: 'report' | 'task'
  title: string
  notes?: string
  /** Solo informes. */
  to: string[]
  cc: string[]
  subjectPeriod: SubjectPeriod
  /** null = tarea sin fecha ("algún día"). */
  rule: Rule | null
  /** Hora opcional 'HH:MM' (tareas). */
  time?: string
  priority: 'normal' | 'high'
  /** Activa el aviso el día hábil anterior. */
  remindDayBefore: boolean
  active: boolean
  createdAt: ISODate
}

/** Una ocurrencia marcada como hecha. `date` es la fecha original de la ocurrencia. */
export interface Completion {
  itemId: string
  date: ISODate | 'someday'
  doneAt: string
}

/** Cambio puntual de una ocurrencia sin tocar la regla. */
export interface Override {
  itemId: string
  date: ISODate
  movedTo?: ISODate
  skipped?: boolean
}

export interface Holiday {
  date: ISODate
  name: string
  /** 'puente' = día no laborable con fines turísticos. */
  kind: 'feriado' | 'puente' | 'propio'
}

export interface Settings {
  workStart: string
  workEnd: string
  /** Días laborales (1 = lunes … 7 = domingo). */
  workDays: number[]
}

export interface Occurrence {
  item: Item
  /** Fecha original según la regla (clave estable). */
  key: ISODate | 'someday'
  /** Fecha efectiva, tras feriados y cambios puntuales. */
  date: ISODate | null
  done: boolean
  moved: boolean
}
