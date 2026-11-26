import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export type PushStatus = 'loading' | 'unsupported' | 'denied' | 'off' | 'on'

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function vapidKey(): Promise<string> {
  const { vapidPublicKey } = await api<{ vapidPublicKey: string | null }>('/config')
  if (!vapidPublicKey) throw new Error('Los avisos todavía no están configurados en el servidor')
  return vapidPublicKey
}

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

async function register(sub: PushSubscription) {
  const json = sub.toJSON()
  await api('/push/subscribe', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys, timezone: timezone() } })
}

/** Estado y acciones de las notificaciones en este dispositivo. */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supported()) return setStatus('unsupported')
    if (Notification.permission === 'denied') return setStatus('denied')
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    setStatus(sub && Notification.permission === 'granted' ? 'on' : 'off')
    // Por si el servidor la había borrado, la volvemos a registrar.
    if (sub && Notification.permission === 'granted') register(sub).catch(() => {})
  }, [])

  useEffect(() => { refresh().catch(() => setStatus('off')) }, [refresh])

  const enable = useCallback(async () => {
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(await vapidKey()) }))
      await register(sub)
      setStatus('on')
    } catch (e) {
      setError((e as Error).message || 'No se pudieron activar los avisos')
    }
  }, [])

  const disable = useCallback(async () => {
    setError(null)
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {})
      await sub.unsubscribe()
    }
    setStatus('off')
  }, [])

  const test = useCallback(async () => {
    setError(null)
    try {
      await api('/push/test', { method: 'POST' })
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    }
  }, [])

  return { status, error, enable, disable, test }
}
