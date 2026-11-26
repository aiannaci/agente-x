import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Completion, Holiday, Item, Override, Settings } from './types'
import { DEFAULT_HOLIDAYS } from './holidays'
import type { Calendar } from './recurrence'

/**
 * Estado de la app. En esta etapa se guarda en el dispositivo (localStorage).
 * En la etapa 2 esta capa pasa a sincronizar con el servidor, sin cambiar las pantallas.
 */
export interface AppData {
  items: Item[]
  completions: Completion[]
  overrides: Override[]
  holidays: Holiday[]
  settings: Settings
  onboarded: boolean
}

const KEY = 'agente-x:v1'

const DEFAULT_DATA: AppData = {
  items: [],
  completions: [],
  overrides: [],
  holidays: DEFAULT_HOLIDAYS,
  settings: { workStart: '08:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5] },
  onboarded: false,
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_DATA, ...JSON.parse(raw) }
  } catch {
    /* sin almacenamiento disponible */
  }
  return DEFAULT_DATA
}

interface Store extends AppData {
  calendar: Calendar
  saveItem: (item: Item) => void
  deleteItem: (id: string) => void
  addItems: (items: Item[]) => void
  toggleDone: (itemId: string, date: string) => void
  setOverride: (ov: Override | { itemId: string; date: string; clear: true }) => void
  setHolidays: (h: Holiday[]) => void
  setSettings: (s: Settings) => void
  setOnboarded: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* ignorar */
    }
  }, [data])

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])

  const store = useMemo<Store>(() => ({
    ...data,
    calendar: { holidays: new Set(data.holidays.map((h) => h.date)), workDays: data.settings.workDays },
    saveItem: (item) => update((d) => ({
      ...d,
      items: d.items.some((i) => i.id === item.id) ? d.items.map((i) => (i.id === item.id ? item : i)) : [...d.items, item],
    })),
    deleteItem: (id) => update((d) => ({
      ...d,
      items: d.items.filter((i) => i.id !== id),
      completions: d.completions.filter((c) => c.itemId !== id),
      overrides: d.overrides.filter((o) => o.itemId !== id),
    })),
    addItems: (items) => update((d) => ({ ...d, items: [...d.items, ...items], onboarded: true })),
    toggleDone: (itemId, date) => update((d) => {
      const exists = d.completions.some((c) => c.itemId === itemId && c.date === date)
      return {
        ...d,
        completions: exists
          ? d.completions.filter((c) => !(c.itemId === itemId && c.date === date))
          : [...d.completions, { itemId, date, doneAt: new Date().toISOString() }],
      }
    }),
    setOverride: (ov) => update((d) => {
      const rest = d.overrides.filter((o) => !(o.itemId === ov.itemId && o.date === ov.date))
      return { ...d, overrides: 'clear' in ov ? rest : [...rest, ov] }
    }),
    setHolidays: (holidays) => update((d) => ({ ...d, holidays: [...holidays].sort((a, b) => a.date.localeCompare(b.date)) })),
    setSettings: (settings) => update((d) => ({ ...d, settings })),
    setOnboarded: () => update((d) => ({ ...d, onboarded: true })),
  }), [data, update])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}
