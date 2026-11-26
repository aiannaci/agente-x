import { useState } from 'react'
import { Check, Mail, MoreHorizontal, CalendarClock, SkipForward, Pencil, Undo2, Flag } from 'lucide-react'
import type { Occurrence } from '../lib/types'
import { useStore } from '../lib/store'
import { mailtoLink } from '../lib/email'
import { describeRule } from '../lib/recurrence'
import { formatShort, todayISO, diffDays } from '../lib/dates'
import { Button, Tag } from './ui'
import { MeetingCard } from './MeetingCard'

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-lg border-2 transition ${
        checked ? 'border-primary bg-primary text-primary-fg' : 'border-primary/70 hover:bg-soft'
      }`}
    >
      {checked && <Check size={15} strokeWidth={3} />}
    </button>
  )
}

export function OccurrenceCard({ occ, overdue, onEdit, showRule }: { occ: Occurrence; overdue?: boolean; onEdit: (id: string) => void; showRule?: boolean }) {
  const { toggleDone, setOverride } = useStore()
  const [menu, setMenu] = useState(false)
  const [moving, setMoving] = useState(false)
  const { item, key, date, done } = occ
  const isReport = item.kind === 'report'
  // El botón de email solo aparece cuando el envío es inminente (atrasado, hoy o mañana).
  const showMail = isReport && !done && !!date && diffDays(todayISO(), date) <= 1

  if (item.kind === 'meeting') return <MeetingCard occ={occ} onEdit={onEdit} showRule={showRule} />

  return (
    <div className={`rounded-2xl border bg-surface p-3 transition ${overdue && !done ? 'border-danger/50' : 'border-line'}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={done} onChange={() => toggleDone(item.id, key)} label={`Marcar "${item.title}" como hecho`} />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onEdit(item.id)} className="text-left">
            <p className={`text-[15px] font-semibold leading-snug ${done ? 'text-muted line-through' : ''}`}>{item.title}</p>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {isReport ? <Tag>Informe</Tag> : <Tag tone="task">Tarea</Tag>}
            {item.priority === 'high' && <Tag tone="danger"><Flag size={10} className="mr-0.5" />Alta</Tag>}
            {overdue && !done && date && <Tag tone="danger">Atrasado · {formatShort(date)}</Tag>}
            {occ.moved && <Tag tone="outline">Movido</Tag>}
            {item.time && <span>{item.time} h</span>}
            {isReport && (
              <span>
                {item.to.length} Para{item.cc.length ? ` · ${item.cc.length} CC` : ''}
              </span>
            )}
            {showRule && <span>{describeRule(item.rule)}</span>}
          </div>

          {showMail || menu ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {showMail && date && (
                <a
                  href={mailtoLink(item, date)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-fg hover:opacity-90"
                >
                  <Mail size={15} /> Preparar email
                </a>
              )}
              {menu && (
                <>
                  {date && item.rule?.type !== 'once' && (
                    <>
                      <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => setMoving((m) => !m)}>
                        <CalendarClock size={15} /> Mover
                      </Button>
                      <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => setOverride({ itemId: item.id, date: key, skipped: true })}>
                        <SkipForward size={15} /> Saltear
                      </Button>
                    </>
                  )}
                  {occ.moved && (
                    <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => setOverride({ itemId: item.id, date: key, clear: true })}>
                      <Undo2 size={15} /> Volver a su fecha
                    </Button>
                  )}
                  <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => onEdit(item.id)}>
                    <Pencil size={15} /> Editar
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {moving && date && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <label className="text-sm text-muted" htmlFor={`mv-${item.id}-${key}`}>Nueva fecha</label>
              <input
                id={`mv-${item.id}-${key}`}
                type="date"
                className="field !w-auto !py-1.5"
                defaultValue={date}
                onChange={(e) => {
                  if (e.target.value) {
                    setOverride({ itemId: item.id, date: key, movedTo: e.target.value })
                    setMoving(false)
                    setMenu(false)
                  }
                }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setMenu((m) => !m); setMoving(false) }}
          className="rounded-lg p-1 text-muted hover:bg-surface-2"
          aria-label="Más opciones"
          aria-expanded={menu}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  )
}
