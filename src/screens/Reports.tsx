import { useMemo } from 'react'
import { FileText, Plus, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { describeRule, occurrencesInRange } from '../lib/recurrence'
import { addDays, todayISO, formatDayLabel } from '../lib/dates'
import { Button, Empty, Tag } from '../components/ui'

export function Reports({ onEdit, onNew }: { onEdit: (id: string) => void; onNew: () => void }) {
  const { items, completions, overrides, calendar } = useStore()
  const today = todayISO()
  const reports = items.filter((i) => i.kind === 'report')

  const nextDates = useMemo(() => {
    const occ = occurrencesInRange(reports, today, addDays(today, 120), calendar, completions, overrides).filter((o) => !o.done)
    const m = new Map<string, string>()
    for (const o of occ) if (!m.has(o.item.id)) m.set(o.item.id, o.date!)
    return m
  }, [reports, completions, overrides, calendar, today])

  return (
    <div className="grid gap-5">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Informes</h1>
          <p className="text-sm text-muted">{reports.length} {reports.length === 1 ? 'informe' : 'informes'} programados</p>
        </div>
        <Button onClick={onNew}><Plus size={17} /> Nuevo</Button>
      </header>

      {reports.length === 0 ? (
        <Empty icon={<FileText size={28} />} title="Todavía no tenés informes">
          <p className="mb-3">Cargá un informe con sus destinatarios y cuándo se envía.</p>
          <Button variant="soft" onClick={onNew}><Plus size={16} /> Crear informe</Button>
        </Empty>
      ) : (
        <ul className="grid gap-2">
          {reports.map((r) => {
            const next = nextDates.get(r.id)
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onEdit(r.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition hover:border-primary/50"
                >
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-soft text-primary"><FileText size={19} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{r.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{describeRule(r.rule)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{r.to.length} Para{r.cc.length ? ` · ${r.cc.length} CC` : ''}</span>
                      {!r.active && <Tag tone="outline">Pausado</Tag>}
                    </div>
                    {next && r.active && <p className="mt-1 text-xs font-medium text-primary">Próximo: {formatDayLabel(next)}</p>}
                  </div>
                  <ChevronRight size={18} className="flex-none text-muted" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
