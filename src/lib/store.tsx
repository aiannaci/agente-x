import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Completion, Holiday, Item, Override, Settings } from './types'
import { DEFAULT_HOLIDAYS } from './holidays'
import type { Calendar } from './recurrence'
import { api, ApiError } from './api'

/**
 * Estado de la app, sincronizado con el servidor.
 * Los cambios se aplican al instante en pantalla y se envían al servidor en segundo plano.
 * Se guarda una copia en el dispositivo para abrir rápido y ver los datos sin conexión.
 */
export interface UserInfo {
  email: string
  name: string | null
  picture: string | null
}

export interface AppData {
  user: UserInfo
  items: Item[]
  completions: Completion[]
  overrides: Override[]
  holidays: Holiday[]
  settings: Settings
  onboarded: boolean
}

interface ServerData {
  user: UserInfo
  items: Item[]
  completions: Completion[]
  overrides: Override[]
  holidays: Holiday[] | null
  settings: Settings | null
  onboarded: boolean
}

const CACHE_KEY = 'agente-x:cache'
const DEFAULT_SETTINGS: Settings = { workStart: '08:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5] }

const fromServer = (d: ServerData): AppData => ({
  ...d,
  holidays: d.holidays ?? DEFAULT_HOLIDAYS,
  settings: d.settings ?? DEFAULT_SETTINGS,
})

function readCache(): AppData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}
function writeCache(d: AppData | null) {
  try {
    if (d) localStorage.setItem(CACHE_KEY, JSON.stringify(d))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignorar */
  }
}

export type AuthState = 'loading' | 'signed-out' | 'ready'

interface Store extends AppData {
  calendar: Calendar
  syncError: string | null
  saveItem: (item: Item) => void
  deleteItem: (id: string) => void
  addItems: (items: Item[]) => void
  toggleDone: (itemId: string, date: string) => void
  setOverride: (ov: Override | { itemId: string; date: string; clear: true }) => void
  setHolidays: (h: Holiday[]) => void
  setSettings: (s: Settings) => void
  setOnboarded: () => void
  logout: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
const AuthCtx = createContext<{ state: AuthState; reload: () => Promise<void> }>({ state: 'loading', reload: async () => {} })

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(readCache)
  const [auth, setAuth] = useState<AuthState>(data ? 'ready' : 'loading')
  const [syncError, setSyncError] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const reload = useCallback(async () => {
    try {
      const d = fromServer(await api<ServerData>('/data'))
      setData(d)
      setAuth('ready')
      setSyncError(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setData(null)
        setAuth('signed-out')
      } else if (dataRef.current) {
        setSyncError('Sin conexión. Mostrando los últimos datos guardados.')
      } else {
        setAuth('signed-out')
      }
    }
  }, [])

  useEffect(() => {
    reload()
    // Al volver a la app (ej. desde otra pestaña o desde el celu bloqueado), refrescamos.
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  useEffect(() => writeCache(data), [data])

  /** Aplica un cambio local y lo envía al servidor; si falla, avisa y recarga. */
  const mutate = useCallback((local: (d: AppData) => AppData, remote: () => Promise<unknown>) => {
    setData((d) => (d ? local(d) : d))
    remote()
      .then(() => setSyncError(null))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setAuth('signed-out')
        setSyncError('No se pudo guardar el último cambio. Revisá tu conexión.')
        reload()
      })
  }, [reload])

  const store = useMemo<Store | null>(() => {
    if (!data) return null
    return {
      ...data,
      syncError,
      calendar: { holidays: new Set(data.holidays.map((h) => h.date)), workDays: data.settings.workDays },
      saveItem: (item) => mutate(
        (d) => ({ ...d, items: d.items.some((i) => i.id === item.id) ? d.items.map((i) => (i.id === item.id ? item : i)) : [...d.items, item] }),
        () => api('/items', { method: 'POST', body: [item] }),
      ),
      deleteItem: (id) => mutate(
        (d) => ({
          ...d,
          items: d.items.filter((i) => i.id !== id),
          completions: d.completions.filter((c) => c.itemId !== id),
          overrides: d.overrides.filter((o) => o.itemId !== id),
        }),
        () => api(`/items/${id}`, { method: 'DELETE' }),
      ),
      addItems: (items) => mutate(
        (d) => ({ ...d, items: [...d.items, ...items], onboarded: true }),
        () => Promise.all([api('/items', { method: 'POST', body: items }), api('/profile', { method: 'PATCH', body: { onboarded: true } })]),
      ),
      toggleDone: (itemId, date) => {
        const exists = data.completions.some((c) => c.itemId === itemId && c.date === date)
        const doneAt = new Date().toISOString()
        mutate(
          (d) => ({
            ...d,
            completions: exists
              ? d.completions.filter((c) => !(c.itemId === itemId && c.date === date))
              : [...d.completions, { itemId, date, doneAt }],
          }),
          () => api('/completions', { method: exists ? 'DELETE' : 'PUT', body: { itemId, date, doneAt } }),
        )
      },
      setOverride: (ov) => mutate(
        (d) => {
          const rest = d.overrides.filter((o) => !(o.itemId === ov.itemId && o.date === ov.date))
          return { ...d, overrides: 'clear' in ov ? rest : [...rest, ov] }
        },
        () => api('/overrides', { method: 'clear' in ov ? 'DELETE' : 'PUT', body: ov }),
      ),
      setHolidays: (holidays) => {
        const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
        mutate((d) => ({ ...d, holidays: sorted }), () => api('/profile', { method: 'PATCH', body: { holidays: sorted } }))
      },
      setSettings: (settings) => mutate((d) => ({ ...d, settings }), () => api('/profile', { method: 'PATCH', body: { settings } })),
      setOnboarded: () => mutate((d) => ({ ...d, onboarded: true }), () => api('/profile', { method: 'PATCH', body: { onboarded: true } })),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {})
        setData(null)
        setAuth('signed-out')
      },
    }
  }, [data, syncError, mutate])

  return (
    <AuthCtx.Provider value={{ state: auth, reload }}>
      {store ? <Ctx.Provider value={store}>{children}</Ctx.Provider> : children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore fuera de StoreProvider')
  return s
}
