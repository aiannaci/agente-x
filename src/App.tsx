import { useEffect, useState } from 'react'
import { Sun, CalendarDays, FileText, ListTodo, History as HistoryIcon, Settings, Plus, Share2, Check } from 'lucide-react'
import { useShareApp } from './components/ShareApp'
import { Logo } from './components/Logo'
import { ItemEditor } from './components/ItemEditor'
import { SettingsSheet } from './components/SettingsSheet'
import { Today } from './screens/Today'
import { Upcoming } from './screens/Upcoming'
import { Reports } from './screens/Reports'
import { Agenda } from './screens/Agenda'
import { History } from './screens/History'
import type { Item } from './lib/types'
import { useStore } from './lib/store'

const TABS = [
  { id: 'hoy', label: 'Hoy', icon: Sun },
  { id: 'proximos', label: 'Próximos', icon: CalendarDays },
  { id: 'informes', label: 'Informes', icon: FileText },
  { id: 'agenda', label: 'Agenda', icon: ListTodo },
  { id: 'historial', label: 'Historial', icon: HistoryIcon },
] as const
type Tab = (typeof TABS)[number]['id']

const tabFromHash = (): Tab => {
  const h = location.hash.slice(1)
  return (TABS.find((t) => t.id === h)?.id ?? 'hoy') as Tab
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [editor, setEditor] = useState<{ id?: string; kind: Item['kind'] } | null>(null)
  const [settings, setSettings] = useState(false)
  const { syncError } = useStore()
  const shareApp = useShareApp()

  useEffect(() => {
    const on = () => setTab(tabFromHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])

  const go = (t: Tab) => {
    location.hash = t
    setTab(t)
    scrollTo({ top: 0 })
  }
  const edit = (id: string) => setEditor({ id, kind: 'report' })
  const newItem = (kind: Item['kind']) => setEditor({ kind })

  return (
    <div className="min-h-full md:flex">
      {/* Barra lateral (compu) */}
      <aside className="sticky top-0 hidden h-dvh w-60 flex-none flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <Logo size={36} />
          <span className="font-display text-lg font-bold">Agente X</span>
        </div>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${tab === t.id ? 'bg-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg'}`}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={shareApp.share} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg">
          {shareApp.copied ? <><Check size={18} /> Link copiado</> : <><Share2 size={18} /> Compartir app</>}
        </button>
        <button type="button" onClick={() => setSettings(true)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-fg">
          <Settings size={18} /> Ajustes
        </button>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Encabezado (celu) */}
        <header className="safe-top sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur md:hidden">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Logo size={32} />
            <span className="font-display text-lg font-bold">Agente X</span>
            <div className="flex-1" />
            <button type="button" onClick={shareApp.share} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Compartir la app">
              {shareApp.copied ? <Check size={20} /> : <Share2 size={20} />}
            </button>
            <button type="button" onClick={() => setSettings(true)} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Ajustes">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 pb-32 pt-5 md:px-8 md:pb-16 md:pt-10">
          {syncError && <p role="status" className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{syncError}</p>}
          {tab === 'hoy' && <Today onEdit={edit} onNewReport={() => newItem('report')} />}
          {tab === 'proximos' && <Upcoming onEdit={edit} />}
          {tab === 'informes' && <Reports onEdit={edit} onNew={() => newItem('report')} />}
          {tab === 'agenda' && <Agenda onEdit={edit} onNew={newItem} />}
          {tab === 'historial' && <History />}
        </main>
      </div>

      {/* Botón flotante: nuevo */}
      {(tab === 'hoy' || tab === 'proximos') && (
        <button type="button" onClick={() => newItem('task')}
          className="brand-gradient fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-primary/30 transition hover:scale-105 md:bottom-8 md:right-8"
          aria-label="Nuevo informe o tarea">
          <Plus size={26} />
        </button>
      )}

      {/* Navegación inferior (celu) */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 pb-2.5 pt-2 text-[11px] font-semibold ${tab === t.id ? 'text-primary' : 'text-muted'}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${tab === t.id ? 'bg-soft' : ''}`}><t.icon size={19} /></span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {editor && <ItemEditor itemId={editor.id} kind={editor.kind} onClose={() => setEditor(null)} />}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  )
}
