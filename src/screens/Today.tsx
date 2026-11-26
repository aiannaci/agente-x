import { useMemo } from 'react'
import { PartyPopper, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { occurrencesInRange, isBusinessDay } from '../lib/recurrence'
import { addDays, todayISO, formatDayLabel, cap, MONTHS, fromISO, WEEKDAYS, weekday } from '../lib/dates'
import { OccurrenceCard } from '../components/OccurrenceCard'
import { Button, Empty, Section } from '../components/ui'
import { Logo } from '../components/Logo'

export function Today({ onEdit, onNewReport }: { onEdit: (id: string) => void; onNewReport: () => void }) {
  const { items, completions, overrides, calendar, onboarded, setOnboarded, holidays, user } = useStore()
  const today = todayISO()

  const { overdue, todays, next, nextDate } = useMemo(() => {
    const overdue = occurrencesInRange(items, addDays(today, -60), addDays(today, -1), calendar, completions, overrides).filter((o) => !o.done)
    const todays = occurrencesInRange(items, today, today, calendar, completions, overrides)
    let nextDate = addDays(today, 1)
    for (let i = 0; i < 10 && !isBusinessDay(nextDate, calendar); i++) nextDate = addDays(nextDate, 1)
    const next = occurrencesInRange(items, addDays(today, 1), nextDate, calendar, completions, overrides)
    return { overdue, todays, next, nextDate }
  }, [items, completions, overrides, calendar, today])

  const pending = overdue.length + todays.filter((o) => !o.done).length
  const d = fromISO(today)
  const holidayToday = holidays.find((h) => h.date === today)

  return (
    <div className="grid gap-6">
      <header className="grid gap-1 px-1">
        <p className="text-sm text-muted">{cap(WEEKDAYS[weekday(today) - 1])} {d.getDate()} de {MONTHS[d.getMonth()]}</p>
        <h1 className="text-2xl font-bold md:text-3xl">
          {pending === 0 ? 'Todo al día' : pending === 1 ? <>Tenés <span className="brand-text">1 pendiente</span></> : <>Tenés <span className="brand-text">{pending} pendientes</span></>}
        </h1>
        {holidayToday && <p className="text-sm text-muted">Hoy es feriado: {holidayToday.name}</p>}
      </header>

      {!onboarded && items.length === 0 && (
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
          <Logo size={56} />
          <div className="flex-1">
            <p className="font-semibold">¡Hola{user.name ? `, ${user.name.split(' ')[0]}` : ''}! Soy Agente X.</p>
            <p className="text-sm text-muted">Cargá tu primer informe con sus destinatarios y días de envío, y yo te recuerdo cuándo mandarlo.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setOnboarded(); onNewReport() }}><Plus size={16} /> Crear mi primer informe</Button>
            <Button variant="ghost" onClick={setOnboarded}>Después</Button>
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <Section title={<span className="text-danger">Atrasados</span>} aside={`${overdue.length}`}>
          {overdue.map((o) => <OccurrenceCard key={o.item.id + o.key} occ={o} overdue onEdit={onEdit} />)}
        </Section>
      )}

      <Section title="Hoy" aside={todays.length ? `${todays.filter((o) => o.done).length}/${todays.length} hechos` : undefined}>
        {todays.length ? (
          todays.map((o) => <OccurrenceCard key={o.item.id + o.key} occ={o} onEdit={onEdit} />)
        ) : (
          <Empty icon={<PartyPopper size={28} />} title="Nada para hoy">No tenés informes ni tareas con fecha de hoy.</Empty>
        )}
      </Section>

      <Section title={nextDate === addDays(today, 1) ? `Mañana · ${formatDayLabel(nextDate)}` : `Próximo día hábil · ${formatDayLabel(nextDate)}`}>
        {next.length ? (
          next.map((o) => <OccurrenceCard key={o.item.id + o.key} occ={o} onEdit={onEdit} />)
        ) : (
          <p className="px-1 text-sm text-muted">Sin pendientes.</p>
        )}
      </Section>
    </div>
  )
}
