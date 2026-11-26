import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/store'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
        }
      }
    }
  }
}

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se pudo cargar el login de Google'))
    document.head.appendChild(s)
  })
}

export function Login() {
  const { reload } = useAuth()
  const [config, setConfig] = useState<{ googleClientId: string | null; devLogin: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devEmail, setDevEmail] = useState('')
  const btn = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api<{ googleClientId: string | null; devLogin: boolean }>('/config')
      .then(setConfig)
      .catch(() => setError('No hay conexión con el servidor. Revisá tu internet y volvé a intentar.'))
  }, [])

  useEffect(() => {
    if (!config?.googleClientId || !btn.current) return
    loadGoogleScript()
      .then(() => {
        window.google!.accounts.id.initialize({
          client_id: config.googleClientId!,
          callback: async ({ credential }) => {
            setError(null)
            try {
              await api('/auth/google', { method: 'POST', body: { credential } })
              await reload()
            } catch (e) {
              setError(`No se pudo iniciar sesión: ${(e as Error).message}`)
            }
          },
        })
        const dark = matchMedia('(prefers-color-scheme: dark)').matches
        window.google!.accounts.id.renderButton(btn.current!, {
          theme: dark ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es-419', width: 280,
        })
      })
      .catch((e) => setError(e.message))
  }, [config, reload])

  async function devLogin(e: FormEvent) {
    e.preventDefault()
    await api('/auth/dev', { method: 'POST', body: { email: devEmail } })
    await reload()
  }

  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="grid w-full max-w-sm justify-items-center gap-6 text-center">
        <Logo size={96} />
        <div className="grid gap-2">
          <h1 className="text-3xl font-bold">Agente <span className="brand-text">X</span></h1>
          <p className="text-muted">Tus informes y tareas, siempre a tiempo. Te aviso qué mandar, a quién y cuándo.</p>
        </div>

        <div className="grid min-h-11 justify-items-center">
          {config?.googleClientId && <div ref={btn} />}
          {config && !config.googleClientId && !config.devLogin && (
            <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">El ingreso con Google se está terminando de configurar. Volvé a intentar en un rato.</p>
          )}
        </div>

        {config?.devLogin && (
          <form onSubmit={devLogin} className="grid w-full gap-2 rounded-2xl border border-dashed border-line p-3">
            <p className="text-xs text-muted">Ingreso de prueba (solo desarrollo)</p>
            <input className="field" type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} placeholder="email@ejemplo.com" aria-label="Email de prueba" />
            <Button type="submit" variant="soft" disabled={!devEmail}>Entrar</Button>
          </form>
        )}

        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <p className="text-xs text-muted">Cada persona ve solo sus propios informes y tareas.</p>
      </div>
    </div>
  )
}
