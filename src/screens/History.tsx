import { useMemo } from 'react'
import { History as HistoryIcon, Undo2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { toISO, formatDayLabel, formatShort, cap, todayISO, addDays } from '../lib/dates'
import { Empty, Section, Tag } from '../components/ui'

export function History() {
  const { completions, items, toggleDone } = useStore()
  const byId = new Map(items.map((i) => [i.id, i]))
  const today = todayISO()

  const groups = useMemo(() => {
    const sorted = [...completions].sort((a, b) => b.doneAt.localeCompare(a.doneAt))
    const map = new Map<string, typeof sorted>()
    for (const c of sorted) {
      const day = toISO(new Date(c.doneAt))
      map.set(day, [...(map.get(day) ?? []), c])
    }
    return [...map.entries()]
  }, [completions])

  const label = (d: string) => (d === today ? 'Hoy' : d === addDays(today, -1) ? 'Ayer' : cap(formatDayLabel(d)))

  return (
    <div className="grid gap-6">
      <header className="px-1">
        <h1 className="text-2xl font-bold md:text-3xl">Historial</h1>
        <p className="text-sm text-muted">Lo que marcaste como hecho, del más reciente al más antiguo.</p>
      </header>
      {groups.length === 0 ? (
        <Empty icon={<HistoryIcon size={28} />} title="Todavía no hay nada">Cuando marques un informe o una tarea como hecho, queda registrado acá.</Empty>
      ) : (
        groups.map(([day, list]) => (
          <Section key={day} title={label(day)}>
            {list.map((c) => {
              const item = byId.get(c.itemId)
              if (!item) return null
              const time = new Date(c.doneAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={c.itemId + c.date} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {item.kind === 'report' ? <Tag>Informe</Tag> : <Tag tone="task">Tarea</Tag>}
                      <span>Hecho a las {time}</span>
                      {c.date !== 'someday' && <span>· correspondía al {formatShort(c.date)}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => toggleDone(c.itemId, c.date)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2" aria-label={`Deshacer "${item.title}"`}>
                    <Undo2 size={14} /> Deshacer
                  </button>
                </div>
              )
            })}
          </Section>
        ))
      )}
    </div>
  )
}
