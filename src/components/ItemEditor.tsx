import { useMemo, useState, type KeyboardEvent } from 'react'
import { Trash2, X, Info } from 'lucide-react'
import type { Item, Rule, SubjectPeriod } from '../lib/types'
import { useStore } from '../lib/store'
import { ruleOccurrences, emailSubject, defaultSubjectPeriod, describeRule } from '../lib/recurrence'
import { addDays, todayISO, formatDayLabel, cap, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/dates'
import { isEmail, parseEmails } from '../lib/email'
import { newId } from '../lib/seed'
import { Button, Sheet } from './ui'

type RuleType = 'none' | Rule['type']

function EmailInput({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const commit = (raw = text) => {
    const add = parseEmails(raw).filter((e) => !value.includes(e))
    if (add.length) onChange([...value, ...add])
    setText('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === ' ') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="label">{label}</label>
      <div className="field flex flex-wrap gap-1.5 !py-2" onClick={() => document.getElementById(id)?.focus()}>
        {value.map((e) => (
          <span key={e} className={`inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-0.5 text-[13px] ${isEmail(e) ? 'bg-soft' : 'bg-danger-soft text-danger'}`}>
            <span className="truncate">{e}</span>
            <button type="button" onClick={() => onChange(value.filter((x) => x !== e))} aria-label={`Quitar ${e}`} className="text-muted hover:text-fg"><X size={13} /></button>
          </span>
        ))}
        <input
          id={id}
          className="min-w-[10ch] flex-1 bg-transparent text-[15px] outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => commit()}
          onPaste={(e) => { e.preventDefault(); commit(text + ' ' + e.clipboardData.getData('text')) }}
          placeholder={value.length ? '' : 'nombre@empresa.com'}
          inputMode="email"
          autoComplete="off"
        />
      </div>
    </div>
  )
}

const N_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function ItemEditor({ itemId, kind, onClose }: { itemId?: string; kind: Item['kind']; onClose: () => void }) {
  const { items, saveItem, deleteItem, calendar } = useStore()
  const existing = items.find((i) => i.id === itemId)
  const today = todayISO()

  const [k, setK] = useState<Item['kind']>(existing?.kind ?? kind)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [to, setTo] = useState<string[]>(existing?.to ?? [])
  const [cc, setCc] = useState<string[]>(existing?.cc ?? [])
  const [time, setTime] = useState(existing?.time ?? '')
  const [priority, setPriority] = useState<Item['priority']>(existing?.priority ?? 'normal')
  const [remindDayBefore, setRemind] = useState(existing?.remindDayBefore ?? false)
  const [active, setActive] = useState(existing?.active ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const r = existing?.rule
  const [ruleType, setRuleType] = useState<RuleType>(r?.type ?? (kind === 'report' ? 'weekly' : 'none'))
  const [days, setDays] = useState<number[]>(r?.type === 'weekly' ? r.days : [1])
  const [monthDay, setMonthDay] = useState<number | 'last'>(r?.type === 'monthDay' ? r.day : 1)
  const [bdN, setBdN] = useState<number>(r?.type === 'businessDay' ? r.n : 1)
  const [nwN, setNwN] = useState<number>(r?.type === 'nthWeekday' ? r.n : 1)
  const [nwDay, setNwDay] = useState<number>(r?.type === 'nthWeekday' ? r.weekday : 1)
  const [onceDate, setOnceDate] = useState<string>(r?.type === 'once' ? r.date : today)
  const [subjectPeriod, setSubjectPeriod] = useState<SubjectPeriod | 'auto'>(existing?.subjectPeriod ?? 'auto')

  const rule: Rule | null = useMemo(() => {
    switch (ruleType) {
      case 'none': return null
      case 'once': return { type: 'once', date: onceDate }
      case 'weekly': return { type: 'weekly', days: [...days].sort() }
      case 'monthDay': return { type: 'monthDay', day: monthDay }
      case 'businessDay': return { type: 'businessDay', n: bdN }
      case 'nthWeekday': return { type: 'nthWeekday', n: nwN, weekday: nwDay }
    }
  }, [ruleType, onceDate, days, monthDay, bdN, nwN, nwDay])

  const effectivePeriod: SubjectPeriod = subjectPeriod === 'auto' ? defaultSubjectPeriod(rule) : subjectPeriod

  const preview = useMemo(() => {
    if (!rule || (rule.type === 'weekly' && rule.days.length === 0)) return []
    return ruleOccurrences(rule, today, addDays(today, 400), calendar).slice(0, 4)
  }, [rule, calendar, today])

  const isReport = k === 'report'
  const invalidEmails = [...to, ...cc].filter((e) => !isEmail(e))
  const canSave = title.trim() && (!isReport || to.length > 0) && invalidEmails.length === 0 && !(rule?.type === 'weekly' && rule.days.length === 0) && !(isReport && !rule)

  function save() {
    if (!canSave) return
    saveItem({
      id: existing?.id ?? newId(),
      kind: k,
      title: title.trim(),
      notes: notes.trim() || undefined,
      to: isReport ? to : [],
      cc: isReport ? cc : [],
      subjectPeriod: effectivePeriod,
      rule,
      time: !isReport && time ? time : undefined,
      priority,
      remindDayBefore,
      active,
      createdAt: existing?.createdAt ?? today,
    })
    onClose()
  }

  const sampleDate = preview[0]?.date ?? today

  return (
    <Sheet
      title={existing ? (isReport ? 'Editar informe' : 'Editar tarea') : isReport ? 'Nuevo informe' : 'Nueva tarea'}
      onClose={onClose}
      footer={
        <>
          {existing && (confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-danger">¿Eliminar?</span>
              <Button variant="danger" onClick={() => { deleteItem(existing.id); onClose() }}>Sí, eliminar</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>No</Button>
            </div>
          ) : (
            <Button variant="ghost" className="!text-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Eliminar</Button>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!canSave}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-5">
        {!existing && (
          <div className="flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Tipo">
            {(['report', 'task'] as const).map((opt) => (
              <button key={opt} type="button" role="tab" aria-selected={k === opt}
                onClick={() => { setK(opt); if (opt === 'report' && ruleType === 'none') setRuleType('weekly') }}
                className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${k === opt ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}>
                {opt === 'report' ? 'Informe' : 'Tarea'}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-1.5">
          <label htmlFor="ed-title" className="label">{isReport ? 'Nombre del informe' : 'Qué tenés que hacer'}</label>
          <input id="ed-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isReport ? 'Ej. Facturas bloqueadas' : 'Ej. Llamar al proveedor'} autoFocus={!existing} />
        </div>

        {isReport && (
          <>
            <EmailInput id="ed-to" label="Para" value={to} onChange={setTo} />
            <EmailInput id="ed-cc" label="CC (opcional)" value={cc} onChange={setCc} />
            {invalidEmails.length > 0 && <p className="-mt-3 text-sm text-danger">Revisá los emails marcados en rojo.</p>}
          </>
        )}

        <fieldset className="grid gap-3">
          <legend className="label mb-1.5">{isReport ? 'Cuándo se envía' : 'Cuándo'}</legend>
          <select className="field" value={ruleType} onChange={(e) => setRuleType(e.target.value as RuleType)} aria-label="Tipo de repetición">
            {!isReport && <option value="none">Sin fecha</option>}
            <option value="once">Una sola vez</option>
            <option value="weekly">Todas las semanas</option>
            <option value="businessDay">Un día hábil del mes (ej. 3er día hábil)</option>
            <option value="monthDay">Un día fijo del mes (ej. el 5)</option>
            <option value="nthWeekday">Un día de la semana del mes (ej. primer martes)</option>
          </select>

          {ruleType === 'once' && (
            <input type="date" className="field" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} aria-label="Fecha" />
          )}

          {ruleType === 'weekly' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días de la semana">
              {WEEKDAYS_SHORT.map((w, i) => {
                const d = i + 1
                const on = days.includes(d)
                return (
                  <button key={d} type="button" aria-pressed={on} aria-label={WEEKDAYS[i]}
                    onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    className={`h-10 w-11 rounded-xl text-sm font-semibold transition ${on ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted hover:text-fg'}`}>
                    {w}
                  </button>
                )
              })}
            </div>
          )}

          {ruleType === 'businessDay' && (
            <select className="field" value={bdN} onChange={(e) => setBdN(Number(e.target.value))} aria-label="Qué día hábil">
              {N_OPTIONS.map((n) => <option key={n} value={n}>{n}º día hábil</option>)}
              <option value={-2}>Anteúltimo día hábil</option>
              <option value={-1}>Último día hábil</option>
            </select>
          )}

          {ruleType === 'monthDay' && (
            <select className="field" value={String(monthDay)} onChange={(e) => setMonthDay(e.target.value === 'last' ? 'last' : Number(e.target.value))} aria-label="Día del mes">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Día {n}</option>)}
              <option value="last">Último día del mes</option>
            </select>
          )}

          {ruleType === 'nthWeekday' && (
            <div className="grid grid-cols-2 gap-2">
              <select className="field" value={nwN} onChange={(e) => setNwN(Number(e.target.value))} aria-label="Cuál">
                <option value={1}>Primer</option><option value={2}>Segundo</option><option value={3}>Tercer</option><option value={4}>Cuarto</option><option value={-1}>Último</option>
              </select>
              <select className="field" value={nwDay} onChange={(e) => setNwDay(Number(e.target.value))} aria-label="Día de la semana">
                {WEEKDAYS.slice(0, 5).map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
              </select>
            </div>
          )}

          {rule && preview.length > 0 && (
            <div className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="mb-1.5 font-semibold">{describeRule(rule)}</p>
              <p className="text-xs text-muted">Próximas fechas:</p>
              <ul className="mt-1 grid gap-0.5">
                {preview.map((p) => (
                  <li key={p.key} className="flex flex-wrap gap-x-2">
                    <span>{cap(formatDayLabel(p.date))}</span>
                    {p.key !== p.date && <span className="text-xs text-pink">(adelantado: el {formatDayLabel(p.key)} no es hábil)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rule && rule.type !== 'once' && (
            <p className="flex gap-1.5 text-xs text-muted"><Info size={14} className="mt-px flex-none" /> Si la fecha cae feriado o fin de semana, se adelanta al día hábil anterior.</p>
          )}
        </fieldset>

        {isReport && (
          <div className="grid gap-1.5">
            <label htmlFor="ed-subject" className="label">Asunto del email</label>
            <select id="ed-subject" className="field" value={subjectPeriod} onChange={(e) => setSubjectPeriod(e.target.value as SubjectPeriod | 'auto')}>
              <option value="auto">Automático</option>
              <option value="date">Con la fecha de envío</option>
              <option value="prevMonth">Con el mes anterior</option>
              <option value="currentMonth">Con el mes en curso</option>
            </select>
            {title.trim() && <p className="text-xs text-muted">Ejemplo: <span className="font-medium text-fg">{emailSubject({ title: title.trim(), subjectPeriod: effectivePeriod } as Item, sampleDate)}</span></p>}
          </div>
        )}

        {!isReport && ruleType !== 'none' && (
          <div className="grid gap-1.5">
            <label htmlFor="ed-time" className="label">Hora (opcional)</label>
            <input id="ed-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        )}

        <div className="grid gap-1.5">
          <label htmlFor="ed-notes" className="label">Notas (opcional)</label>
          <textarea id="ed-notes" className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isReport ? 'Ej. de dónde sacar los datos' : ''} />
        </div>

        <div className="grid gap-3">
          {ruleType !== 'none' && (
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={remindDayBefore} onChange={(e) => setRemind(e.target.checked)} />
              <span><span className="font-medium">Avisarme también el día hábil anterior</span><br /><span className="text-sm text-muted">Útil si lleva preparación.</span></span>
            </label>
          )}
          {!isReport && (
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={priority === 'high'} onChange={(e) => setPriority(e.target.checked ? 'high' : 'normal')} />
              <span className="font-medium">Prioridad alta</span>
            </label>
          )}
          {existing && rule && rule.type !== 'once' && (
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={!active} onChange={(e) => setActive(!e.target.checked)} />
              <span><span className="font-medium">Pausar</span><br /><span className="text-sm text-muted">No aparece en Hoy ni en Próximos hasta que lo reactives.</span></span>
            </label>
          )}
        </div>
      </div>
    </Sheet>
  )
}
