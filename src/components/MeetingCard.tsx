import { useState } from 'react'
import { MoreHorizontal, CalendarClock, XCircle, Pencil, Undo2, MapPin, Video, Bell, BellOff, TriangleAlert } from 'lucide-react'
import type { Occurrence } from '../lib/types'
import { useStore } from '../lib/store'
import { todayISO } from '../lib/dates'
import { describeRule } from '../lib/recurrence'
import { Button, Tag } from './ui'

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim())

function minutesNow() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function MeetingCard({ occ, onEdit, showRule }: { occ: Occurrence; onEdit: (id: string) => void; showRule?: boolean }) {
  const { setOverride, calendar } = useStore()
  const [menu, setMenu] = useState(false)
  const [moving, setMoving] = useState(false)
  const { item, key, date } = occ
  const start = item.time ?? '00:00'
  const end = item.endTime
  const today = todayISO()
  const endMin = end ? toMin(end) : toMin(start) + 60
  const finished = date! < today || (date === today && minutesNow() >= endMin)
  const now = date === today && !finished && minutesNow() >= toMin(start)
  const holiday = date ? calendar.holidays.has(date) : false
  const remind = item.remindMinutes ?? 15

  return (
    <div className={`rounded-2xl border bg-surface p-3 transition ${now ? 'border-cyan' : 'border-line'} ${finished ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="grid w-12 flex-none justify-items-center rounded-xl bg-soft px-1 py-1.5 text-center leading-tight">
          <span className="text-sm font-bold tabular-nums text-primary">{start}</span>
          {end && <span className="text-[11px] tabular-nums text-muted">{end}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onEdit(item.id)} className="text-left">
            <p className="text-[15px] font-semibold leading-snug">{item.title}</p>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Tag tone="meeting">Reunión</Tag>
            {now && <Tag tone="meeting">Ahora</Tag>}
            {finished && date === today && <span>Terminó</span>}
            {holiday && <Tag tone="danger"><TriangleAlert size={10} className="mr-0.5" />Cae feriado</Tag>}
            {occ.moved && <Tag tone="outline">Movida</Tag>}
            {!finished && (remind > 0
              ? <span className="inline-flex items-center gap-0.5"><Bell size={12} /> {remind} min antes</span>
              : <span className="inline-flex items-center gap-0.5"><BellOff size={12} /> Sin aviso</span>)}
            {showRule && <span>{describeRule(item.rule)}</span>}
          </div>
          {item.location && (
            isUrl(item.location) ? (
              date === today && !finished && (
                <a href={item.location.trim()} target="_blank" rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-fg hover:opacity-90">
                  <Video size={15} /> Unirme
                </a>
              )
            ) : (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-muted"><MapPin size={14} className="flex-none" /> <span className="min-w-0 truncate">{item.location}</span></p>
            )
          )}

          {menu && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {item.rule?.type !== 'once' && (
                <>
                  <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => setMoving((m) => !m)}><CalendarClock size={15} /> Mover</Button>
                  <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => setOverride({ itemId: item.id, date: key as string, skipped: true })}><XCircle size={15} /> Cancelar esta</Button>
                </>
              )}
              {occ.moved && (
                <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => setOverride({ itemId: item.id, date: key as string, clear: true })}><Undo2 size={15} /> Volver a su fecha</Button>
              )}
              <Button variant="soft" className="!py-1.5 !text-[13px]" onClick={() => onEdit(item.id)}><Pencil size={15} /> Editar</Button>
            </div>
          )}
          {moving && date && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <label className="text-sm text-muted" htmlFor={`mv-${item.id}-${key}`}>Nueva fecha</label>
              <input id={`mv-${item.id}-${key}`} type="date" className="field !w-auto !py-1.5" defaultValue={date}
                onChange={(e) => { if (e.target.value) { setOverride({ itemId: item.id, date: key as string, movedTo: e.target.value }); setMoving(false); setMenu(false) } }} />
            </div>
          )}
        </div>
        <button type="button" onClick={() => { setMenu((m) => !m); setMoving(false) }} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label="Más opciones" aria-expanded={menu}>
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  )
}
