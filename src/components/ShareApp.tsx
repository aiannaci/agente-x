import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'
import { Button } from './ui'

const TEXT = 'Te recomiendo Agente X: te avisa qué informes y tareas tenés que hacer y cuándo. Entrás con tu cuenta de Google.'

/** Comparte el link de la app con el menú del celu (WhatsApp, mail, etc.) o lo copia. */
export function useShareApp() {
  const [copied, setCopied] = useState(false)
  const url = location.origin

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Agente X', text: TEXT, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // la persona cerró el menú
      }
    }
    await copy()
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copiá este link:', url)
    }
  }

  return { url, share, copy, copied }
}

export function ShareAppCard() {
  const { url, share, copy, copied } = useShareApp()
  return (
    <section className="grid gap-3">
      <h3 className="font-semibold">Compartir Agente X</h3>
      <p className="-mt-2 text-sm text-muted">Mandale el link a quien quieras. Cada persona entra con su cuenta de Google y ve solo sus propios informes y tareas.</p>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm">{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-soft">
          {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
        </button>
      </div>
      <Button onClick={share} className="justify-self-start"><Share2 size={16} /> Compartir link</Button>
    </section>
  )
}
