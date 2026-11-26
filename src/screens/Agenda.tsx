import { useState } from 'react'
import { Tasks } from './Tasks'
import { Meetings } from './Meetings'
import type { Item } from '../lib/types'

type View = 'tareas' | 'reuniones'

export function Agenda({ onEdit, onNew }: { onEdit: (id: string) => void; onNew: (kind: Item['kind']) => void }) {
  const [view, setView] = useState<View>(() => {
    try { return (localStorage.getItem('agente-x:agenda') as View) || 'tareas' } catch { return 'tareas' }
  })
  const pick = (v: View) => {
    setView(v)
    try { localStorage.setItem('agente-x:agenda', v) } catch { /* ignorar */ }
  }
  return (
    <div className="grid gap-5">
      <div className="flex rounded-xl bg-surface-2 p-1" role="tablist" aria-label="Agenda">
        {(['tareas', 'reuniones'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => pick(v)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${view === v ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}>
            {v === 'tareas' ? 'Tareas' : 'Reuniones'}
          </button>
        ))}
      </div>
      {view === 'tareas' ? <Tasks onEdit={onEdit} onNew={() => onNew('task')} /> : <Meetings onEdit={onEdit} onNew={() => onNew('meeting')} />}
    </div>
  )
}
