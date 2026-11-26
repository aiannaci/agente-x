import { useState } from 'react'
import { Trash2, Plus, RotateCcw, LogOut } from 'lucide-react'
import { useStore } from '../lib/store'
import { DEFAULT_HOLIDAYS } from '../lib/holidays'
import { formatShort, todayISO, WEEKDAYS_SHORT, WEEKDAYS } from '../lib/dates'
import { Button, Sheet, Tag } from './ui'
import { ShareAppCard } from './ShareApp'
import { PushSettings } from './PushSettings'

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { settings, setSettings, holidays, setHolidays, user, logout } = useStore()
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [showPast, setShowPast] = useState(false)
  const today = todayISO()
  const visible = holidays.filter((h) => showPast || h.date >= today)

  return (
    <Sheet title="Ajustes" onClose={onClose}>
      <div className="grid gap-7">
        <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          {user.picture ? (
            <img src={user.picture} alt="" className="h-10 w-10 flex-none rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-soft font-semibold">{user.email[0]?.toUpperCase()}</div>
          )}
          <div className="min-w-0 flex-1">
            {user.name && <p className="truncate font-semibold">{user.name}</p>}
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <Button variant="ghost" onClick={logout}><LogOut size={16} /> Salir</Button>
        </section>

        <PushSettings />

        <ShareAppCard />

        <section className="grid gap-3">
          <h3 className="font-semibold">Horario laboral</h3>
          <p className="-mt-2 text-sm text-muted">Las alertas solo llegan dentro de este horario y en estos días.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5"><span className="label">Desde</span>
              <input type="time" className="field" value={settings.workStart} onChange={(e) => setSettings({ ...settings, workStart: e.target.value })} />
            </label>
            <label className="grid gap-1.5"><span className="label">Hasta</span>
              <input type="time" className="field" value={settings.workEnd} onChange={(e) => setSettings({ ...settings, workEnd: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días laborales">
            {WEEKDAYS_SHORT.map((w, i) => {
              const d = i + 1
              const on = settings.workDays.includes(d)
              return (
                <button key={d} type="button" aria-pressed={on} aria-label={WEEKDAYS[i]}
                  onClick={() => setSettings({ ...settings, workDays: on ? settings.workDays.filter((x) => x !== d) : [...settings.workDays, d].sort() })}
                  className={`h-10 w-11 rounded-xl text-sm font-semibold ${on ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted'}`}>
                  {w}
                </button>
              )
            })}
          </div>
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">Feriados y días no laborables</h3>
            <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => setHolidays(DEFAULT_HOLIDAYS)}><RotateCcw size={13} /> Restaurar lista</Button>
          </div>
          <p className="-mt-2 text-sm text-muted">Se usan para contar días hábiles y para adelantar los envíos. Podés sumar días propios (ej. un asueto de la empresa) o quitar los puentes si trabajás esos días.</p>

          <form className="flex flex-wrap gap-2" onSubmit={(e) => {
            e.preventDefault()
            if (!newDate) return
            setHolidays([...holidays.filter((h) => h.date !== newDate), { date: newDate, name: newName.trim() || 'Día no laborable', kind: 'propio' }])
            setNewDate(''); setNewName('')
          }}>
            <input type="date" className="field !w-auto" value={newDate} onChange={(e) => setNewDate(e.target.value)} aria-label="Fecha del feriado" />
            <input className="field min-w-0 flex-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Motivo (opcional)" aria-label="Motivo" />
            <Button type="submit" variant="soft" disabled={!newDate}><Plus size={16} /> Agregar</Button>
          </form>

          <ul className="grid divide-y divide-line rounded-2xl border border-line bg-surface">
            {visible.map((h) => (
              <li key={h.date} className="flex items-center gap-3 px-3 py-2">
                <span className="w-24 flex-none text-sm tabular-nums">{formatShort(h.date)}</span>
                <span className="min-w-0 flex-1 text-sm">{h.name}</span>
                {h.kind !== 'feriado' && <Tag tone="outline">{h.kind === 'puente' ? 'puente' : 'propio'}</Tag>}
                <button type="button" onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-danger" aria-label={`Quitar ${h.name}`}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="justify-self-start text-sm font-semibold text-primary" onClick={() => setShowPast((s) => !s)}>
            {showPast ? 'Ocultar feriados pasados' : 'Ver también los feriados pasados'}
          </button>
        </section>
      </div>
    </Sheet>
  )
}
