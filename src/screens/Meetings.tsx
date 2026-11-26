import { useMemo } from 'react'
import { Users, Plus, Repeat } from 'lucide-react'
import { useStore } from '../lib/store'
import { describeRule, occurrencesInRange } from '../lib/recurrence'
import { addDays, todayISO, formatDayLabel, cap } from '../lib/dates'
import { OccurrenceCard } from '../components/OccurrenceCard'
import { Button, Empty, Section } from '../components/ui'

export function Meetings({ onEdit, onNew }: { onEdit: (id: string) => void; onNew: () => void }) {
  const { items, completions, overrides, calendar } = useStore()
  const today = todayISO()
  const meetings = items.filter((i) => i.kind === 'meeting')

  const groups = useMemo(() => {
    const occ = occurrencesInRange(meetings, today, addDays(today, 31), calendar, completions, overrides)
    const map = new Map<string, typeof occ>()
    for (const o of occ) map.set(o.date!, [...(map.get(o.date!) ?? []), o])
    return [...map.entries()]
  }, [meetings, completions, overrides, calendar, today])

  const recurring = meetings.filter((m) => m.rule && m.rule.type !== 'once')

  return (
    <div className="grid gap-6">
      <header className="flex items-end justify-between gap-3 px-1">
        <h1 className="text-2xl font-bold md:text-3xl">Reuniones</h1>
        <Button onClick={onNew}><Plus size={17} /> Nueva</Button>
      </header>

      {meetings.length === 0 ? (
        <Empty icon={<Users size={28} />} title="Sin reuniones">
          <p className="mb-3">Agendá tus reuniones y te aviso antes de que empiecen. Si se repiten todas las semanas, cargalas una sola vez.</p>
          <Button variant="soft" onClick={onNew}><Plus size={16} /> Agendar reunión</Button>
        </Empty>
      ) : groups.length === 0 ? (
        <p className="px-1 text-sm text-muted">No tenés reuniones en los próximos 30 días.</p>
      ) : (
        groups.map(([date, occ]) => (
          <Section key={date} title={date === today ? 'Hoy' : cap(formatDayLabel(date))}>
            {occ.map((o) => <OccurrenceCard key={o.item.id + o.key} occ={o} onEdit={onEdit} />)}
          </Section>
        ))
      )}

      {recurring.length > 0 && (
        <Section title="Reuniones que se repiten">
          {recurring.map((m) => (
            <button key={m.id} type="button" onClick={() => onEdit(m.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:border-primary/50">
              <Repeat size={17} className="flex-none text-cyan" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{m.title}</span>
                <span className="text-xs text-muted">{describeRule(m.rule)} · {m.time}{m.endTime ? ` a ${m.endTime}` : ''}{m.active ? '' : ' · Pausada'}</span>
              </span>
            </button>
          ))}
        </Section>
      )}
    </div>
  )
}
