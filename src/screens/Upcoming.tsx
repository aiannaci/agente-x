import { useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useStore } from '../lib/store'
import { occurrencesInRange } from '../lib/recurrence'
import { addDays, todayISO, formatDayLabel, cap } from '../lib/dates'
import type { Occurrence } from '../lib/types'
import { OccurrenceCard } from '../components/OccurrenceCard'
import { Empty, Section } from '../components/ui'

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 31, label: '1 mes' },
  { days: 92, label: '3 meses' },
]

export function Upcoming({ onEdit }: { onEdit: (id: string) => void }) {
  const { items, completions, overrides, calendar, holidays } = useStore()
  const [range, setRange] = useState(31)
  const today = todayISO()

  const groups = useMemo(() => {
    const occ = occurrencesInRange(items, addDays(today, 1), addDays(today, range), calendar, completions, overrides)
    const map = new Map<string, Occurrence[]>()
    for (const o of occ) map.set(o.date!, [...(map.get(o.date!) ?? []), o])
    return [...map.entries()]
  }, [items, completions, overrides, calendar, today, range])

  const holidayIn = holidays.filter((h) => h.date > today && h.date <= addDays(today, range))

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <h1 className="text-2xl font-bold md:text-3xl">Próximos</h1>
        <div className="flex rounded-xl bg-surface-2 p-1" role="tablist">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              role="tab"
              aria-selected={range === r.days}
              onClick={() => setRange(r.days)}
              className={`rounded-lg px-3 py-1 text-sm font-semibold ${range === r.days ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {holidayIn.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 text-xs text-muted">
          <span className="font-semibold">Feriados en el período:</span>
          {holidayIn.map((h) => <span key={h.date}>{formatDayLabel(h.date)} ({h.kind === 'puente' ? 'puente' : h.name})</span>)}
        </div>
      )}

      {groups.length === 0 ? (
        <Empty icon={<CalendarDays size={28} />} title="Nada programado">Cuando cargues informes o tareas con fecha, los vas a ver acá.</Empty>
      ) : (
        groups.map(([date, occ]) => (
          <Section key={date} title={cap(formatDayLabel(date))}>
            {occ.map((o) => <OccurrenceCard key={o.item.id + o.key} occ={o} onEdit={onEdit} />)}
          </Section>
        ))
      )}
    </div>
  )
}
