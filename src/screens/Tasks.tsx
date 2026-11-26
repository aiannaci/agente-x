import { useMemo, useState, type FormEvent } from 'react'
import { ListTodo, Plus, Repeat, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../lib/store'
import { describeRule, occurrencesInRange } from '../lib/recurrence'
import { addDays, todayISO, formatDayLabel, cap } from '../lib/dates'
import { newId } from '../lib/seed'
import type { Item } from '../lib/types'
import { OccurrenceCard, Checkbox } from '../components/OccurrenceCard'
import { Button, Empty, Section, Tag } from '../components/ui'

export function Tasks({ onEdit, onNew }: { onEdit: (id: string) => void; onNew: () => void }) {
  const { items, completions, overrides, calendar, saveItem, toggleDone } = useStore()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const today = todayISO()
  const tasks = items.filter((i) => i.kind === 'task')

  const { overdue, dated } = useMemo(() => {
    const overdue = occurrencesInRange(tasks, addDays(today, -60), addDays(today, -1), calendar, completions, overrides).filter((o) => !o.done)
    const dated = occurrencesInRange(tasks, today, addDays(today, 31), calendar, completions, overrides)
    return { overdue, dated }
  }, [tasks, completions, overrides, calendar, today])

  const doneSet = new Set(completions.map((c) => `${c.itemId}|${c.date}`))
  const someday = tasks.filter((t) => !t.rule && t.active)
  const somedayPending = someday.filter((t) => !doneSet.has(`${t.id}|someday`))
  const somedayDone = someday.filter((t) => doneSet.has(`${t.id}|someday`))
  const recurring = tasks.filter((t) => t.rule && t.rule.type !== 'once')

  function quickAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const item: Item = {
      id: newId(), kind: 'task', title: title.trim(), to: [], cc: [], subjectPeriod: 'date',
      rule: date ? { type: 'once', date } : null, priority: 'normal', remindDayBefore: false, active: true, createdAt: today,
    }
    saveItem(item)
    setTitle('')
    setDate('')
  }

  return (
    <div className="grid gap-6">
      <header className="flex items-end justify-between gap-3 px-1">
        <h1 className="text-2xl font-bold md:text-3xl">Tareas</h1>
        <Button variant="soft" onClick={onNew}><SlidersHorizontal size={16} /> Tarea detallada</Button>
      </header>

      <form onSubmit={quickAdd} className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2">
        <label htmlFor="quick-title" className="sr-only">Nueva tarea</label>
        <input id="quick-title" className="field min-w-0 flex-1 !border-0 !shadow-none" placeholder="Nueva tarea… (ej. llamar al proveedor)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="quick-date" className="sr-only">Fecha</label>
        <input id="quick-date" type="date" className="field !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button type="submit" disabled={!title.trim()}><Plus size={17} /> Agregar</Button>
      </form>

      {tasks.length === 0 && (
        <Empty icon={<ListTodo size={28} />} title="Sin tareas">Anotá cualquier cosa que tengas que hacer, aunque no sea un informe. Si le ponés fecha, te aviso ese día.</Empty>
      )}

      {overdue.length > 0 && (
        <Section title={<span className="text-danger">Atrasadas</span>}>
          {overdue.map((o) => <OccurrenceCard key={o.item.id + o.key} occ={o} overdue onEdit={onEdit} />)}
        </Section>
      )}

      {dated.length > 0 && (
        <Section title="Con fecha · próximos 30 días">
          {dated.map((o) => (
            <div key={o.item.id + o.key} className="grid gap-1">
              <span className="px-1 text-xs text-muted">{o.date === today ? 'Hoy' : cap(formatDayLabel(o.date!))}</span>
              <OccurrenceCard occ={o} onEdit={onEdit} />
            </div>
          ))}
        </Section>
      )}

      {somedayPending.length > 0 && (
        <Section title="Sin fecha">
          {somedayPending.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
              <Checkbox checked={false} onChange={() => toggleDone(t.id, 'someday')} label={`Marcar "${t.title}" como hecha`} />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(t.id)}>
                <p className="font-semibold leading-snug">{t.title}</p>
                {t.priority === 'high' && <div className="mt-1"><Tag tone="danger">Alta</Tag></div>}
              </button>
            </div>
          ))}
        </Section>
      )}

      {recurring.length > 0 && (
        <Section title="Tareas que se repiten">
          {recurring.map((t) => (
            <button key={t.id} type="button" onClick={() => onEdit(t.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:border-primary/50">
              <Repeat size={17} className="flex-none text-pink" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{t.title}</span>
                <span className="text-xs text-muted">{describeRule(t.rule)}</span>
              </span>
            </button>
          ))}
        </Section>
      )}

      {somedayDone.length > 0 && (
        <Section title="Hechas (sin fecha)">
          {somedayDone.map((t) => (
            <div key={t.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3 opacity-70">
              <Checkbox checked onChange={() => toggleDone(t.id, 'someday')} label={`Desmarcar "${t.title}"`} />
              <p className="min-w-0 flex-1 text-muted line-through">{t.title}</p>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}
