import { useState } from 'react'
import { Bell, BellOff, BellRing, Send } from 'lucide-react'
import { usePush } from '../lib/push'
import { useStore } from '../lib/store'
import { Button } from './ui'

/** Tarjeta para activar los avisos (se muestra en Hoy cuando están apagados). */
export function PushPrompt() {
  const { status, enable, error } = usePush()
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('agente-x:push-dismissed') === '1' } catch { return false }
  })
  if (status !== 'off' || dismissed) return null
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-primary/30 bg-soft p-4 sm:flex-row sm:items-center">
      <BellRing size={28} className="flex-none text-primary" />
      <div className="flex-1">
        <p className="font-semibold">Activá los avisos en este dispositivo</p>
        <p className="text-sm text-muted">Te aviso a la mañana lo que tenés que enviar, insisto si queda pendiente y te recuerdo las reuniones antes de que empiecen.</p>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={enable}><Bell size={16} /> Activar</Button>
        <Button variant="ghost" onClick={() => { setDismissed(true); try { localStorage.setItem('agente-x:push-dismissed', '1') } catch { /* ignorar */ } }}>Ahora no</Button>
      </div>
    </div>
  )
}

/** Sección de Ajustes. */
export function PushSettings() {
  const { status, enable, disable, test, error } = usePush()
  const { settings } = useStore()
  const [tested, setTested] = useState(false)

  const add = (t: string, m: number) => {
    const [h, mm] = t.split(':').map(Number)
    const x = h * 60 + mm + m
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  }

  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">Avisos</h3>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        {status === 'on' ? <BellRing size={20} className="text-ok" /> : <BellOff size={20} className="text-muted" />}
        <p className="min-w-0 flex-1 text-sm">
          {status === 'loading' && 'Revisando…'}
          {status === 'on' && <><span className="font-semibold">Activados</span> en este dispositivo.</>}
          {status === 'off' && <><span className="font-semibold">Apagados</span> en este dispositivo.</>}
          {status === 'denied' && 'Bloqueaste los avisos para esta app. Para activarlos, entrá a la configuración del navegador → Notificaciones y permitilas para este sitio.'}
          {status === 'unsupported' && 'Este navegador no permite avisos. En Android usá Chrome e instalá la app en la pantalla de inicio.'}
        </p>
        {status === 'off' && <Button onClick={enable}><Bell size={16} /> Activar</Button>}
        {status === 'on' && (
          <>
            <Button variant="soft" onClick={async () => setTested(await test())}><Send size={15} /> {tested ? 'Enviado' : 'Probar'}</Button>
            <Button variant="ghost" onClick={disable}>Desactivar</Button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <ul className="grid gap-1 text-sm text-muted">
        <li>• <span className="text-fg">{add(settings.workStart, 15)}</span>: lo que tenés que enviar o hacer hoy, y lo atrasado.</li>
        <li>• <span className="text-fg">13:00</span> y <span className="text-fg">{add(settings.workEnd, -60)}</span>: lo de hoy que sigue pendiente.</li>
        <li>• <span className="text-fg">{add(settings.workEnd, -30)}</span>: lo de mañana, en los informes con "avisarme el día anterior".</li>
        <li>• Reuniones: los minutos antes que elegiste en cada una.</li>
      </ul>
      <p className="text-xs text-muted">Los avisos de informes y tareas solo llegan los días hábiles. Activalos en cada dispositivo donde quieras recibirlos.</p>
    </section>
  )
}
