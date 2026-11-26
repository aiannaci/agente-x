/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

interface Payload {
  title: string
  body: string
  tag: string
  itemId: string
  key: string
  date: string
  kind: 'report' | 'task' | 'meeting'
  actions: { action: string; title: string }[]
  joinUrl?: string
}

self.addEventListener('push', (event) => {
  let data: Payload
  try {
    data = event.data!.json() as Payload
  } catch {
    data = { title: 'Agente X', body: event.data?.text() ?? '', tag: 'msg', itemId: '', key: '', date: '', kind: 'task', actions: [] }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data,
      requireInteraction: data.kind === 'meeting',
      // @ts-expect-error: `actions` y `renotify` existen en Chrome/Android aunque falten en los tipos.
      actions: data.actions,
      renotify: true,
    }),
  )
})

async function openApp(path = '/') {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = all.find((c) => new URL(c.url).origin === self.location.origin) as WindowClient | undefined
  if (existing) {
    await existing.focus()
    return existing.navigate(path)
  }
  return self.clients.openWindow(path)
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data as Payload
  event.notification.close()

  event.waitUntil((async () => {
    if (event.action === 'done' && data.itemId) {
      const res = await fetch('/api/completions', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId: data.itemId, date: data.key, doneAt: new Date().toISOString() }),
      }).catch(() => null)
      if (!res?.ok) await openApp('/#hoy')
      return
    }
    if (event.action === 'mail' && data.itemId) {
      await openApp(`/?mail=${encodeURIComponent(data.itemId)}&date=${encodeURIComponent(data.date)}#hoy`)
      return
    }
    if ((event.action === 'join' || data.kind === 'meeting') && data.joinUrl) {
      await self.clients.openWindow(data.joinUrl)
      return
    }
    await openApp('/#hoy')
  })())
})
