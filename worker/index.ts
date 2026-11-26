import { verifyGoogleIdToken } from './google'
import { ASSETS } from './assets.gen'
import { sendPush, type VapidKeys } from './webpush'
import { dueNotifications, localNow, type NotificationPayload } from './reminders'
import { DEFAULT_HOLIDAYS } from '../src/lib/holidays'

export interface Env {
  DB: D1Database
  GOOGLE_CLIENT_ID: string
  VAPID_PUBLIC_KEY: string
  /** Secreto (wrangler secret put VAPID_PRIVATE_KEY). */
  VAPID_PRIVATE_KEY?: string
  /** Solo para desarrollo local (.dev.vars): permite entrar sin Google. */
  DEV_LOGIN?: string
}

const COOKIE = 'ax_session'
const SESSION_DAYS = 180

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })

const error = (status: number, message: string) => json({ error: message }, status)

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getCookie(req: Request, name: string): string | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

function sessionCookie(token: string, maxAge: number, secure: boolean) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

async function currentUserId(req: Request, env: Env): Promise<string | null> {
  const token = getCookie(req, COOKIE)
  if (!token) return null
  const row = await env.DB.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256(token), Date.now())
    .first<{ user_id: string }>()
  return row?.user_id ?? null
}

async function startSession(env: Env, req: Request, userId: string): Promise<Response> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expires = Date.now() + SESSION_DAYS * 86400_000
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), userId, expires),
  ])
  const secure = new URL(req.url).protocol === 'https:'
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400, secure) })
}

async function upsertUser(env: Env, p: { sub: string; email: string; name?: string; picture?: string }): Promise<string> {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE google_sub = ?').bind(p.sub).first<{ id: string }>()
  if (existing) {
    await env.DB.prepare('UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?').bind(p.email, p.name ?? null, p.picture ?? null, existing.id).run()
    return existing.id
  }
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO users (id, google_sub, email, name, picture) VALUES (?, ?, ?, ?, ?)').bind(id, p.sub, p.email, p.name ?? null, p.picture ?? null).run()
  return id
}

async function loadData(env: Env, uid: string) {
  const [user, items, completions, overrides] = await env.DB.batch([
    env.DB.prepare('SELECT email, name, picture, settings, holidays, onboarded FROM users WHERE id = ?').bind(uid),
    env.DB.prepare('SELECT data FROM items WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT item_id, date, done_at FROM completions WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT item_id, date, moved_to, skipped FROM overrides WHERE user_id = ?').bind(uid),
  ])
  const u = user.results[0] as { email: string; name: string | null; picture: string | null; settings: string | null; holidays: string | null; onboarded: number }
  return {
    user: { email: u.email, name: u.name, picture: u.picture },
    settings: u.settings ? JSON.parse(u.settings) : null,
    holidays: u.holidays ? JSON.parse(u.holidays) : null,
    onboarded: !!u.onboarded,
    items: (items.results as { data: string }[]).map((r) => JSON.parse(r.data)),
    completions: (completions.results as { item_id: string; date: string; done_at: string }[]).map((r) => ({ itemId: r.item_id, date: r.date, doneAt: r.done_at })),
    overrides: (overrides.results as { item_id: string; date: string; moved_to: string | null; skipped: number }[]).map((r) => ({
      itemId: r.item_id, date: r.date, ...(r.moved_to ? { movedTo: r.moved_to } : {}), ...(r.skipped ? { skipped: true } : {}),
    })),
  }
}

const isStr = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

function validItem(v: any): boolean {
  return v && isStr(v.id, 64) && isStr(v.title, 300) && (v.kind === 'report' || v.kind === 'task' || v.kind === 'meeting') && JSON.stringify(v).length < 20_000
}

async function api(req: Request, env: Env, path: string): Promise<Response> {
  const method = req.method

  if (path === '/api/config' && method === 'GET') {
    return json({ googleClientId: env.GOOGLE_CLIENT_ID || null, devLogin: env.DEV_LOGIN === '1', vapidPublicKey: env.VAPID_PUBLIC_KEY || null })
  }

  if (path === '/api/auth/google' && method === 'POST') {
    if (!env.GOOGLE_CLIENT_ID) return error(503, 'El login con Google todavía no está configurado')
    const { credential } = (await req.json().catch(() => ({}))) as { credential?: string }
    if (!credential) return error(400, 'Falta el token de Google')
    try {
      const profile = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID)
      return startSession(env, req, await upsertUser(env, profile))
    } catch (e) {
      return error(401, (e as Error).message)
    }
  }

  if (path === '/api/auth/dev' && method === 'POST' && env.DEV_LOGIN === '1') {
    const { email } = (await req.json().catch(() => ({}))) as { email?: string }
    if (!email) return error(400, 'Falta email')
    return startSession(env, req, await upsertUser(env, { sub: `dev:${email}`, email, name: email.split('@')[0] }))
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = getCookie(req, COOKIE)
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0, new URL(req.url).protocol === 'https:') })
  }

  // A partir de acá, todo requiere sesión.
  const uid = await currentUserId(req, env)
  if (!uid) return error(401, 'Iniciá sesión')

  if (path === '/api/data' && method === 'GET') return json(await loadData(env, uid))

  if (path === '/api/items' && method === 'POST') {
    const list = (await req.json().catch(() => null)) as unknown[]
    if (!Array.isArray(list) || list.length > 200 || !list.every(validItem)) return error(400, 'Datos inválidos')
    await env.DB.batch(list.map((it: any) =>
      env.DB.prepare("INSERT INTO items (user_id, id, data, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
        .bind(uid, it.id, JSON.stringify(it))))
    return json({ ok: true })
  }

  const itemMatch = path.match(/^\/api\/items\/([\w-]{1,64})$/)
  if (itemMatch && method === 'DELETE') {
    const id = itemMatch[1]
    await env.DB.batch([
      env.DB.prepare('DELETE FROM items WHERE user_id = ? AND id = ?').bind(uid, id),
      env.DB.prepare('DELETE FROM completions WHERE user_id = ? AND item_id = ?').bind(uid, id),
      env.DB.prepare('DELETE FROM overrides WHERE user_id = ? AND item_id = ?').bind(uid, id),
    ])
    return json({ ok: true })
  }

  if (path === '/api/completions' && (method === 'PUT' || method === 'DELETE')) {
    const b = (await req.json().catch(() => ({}))) as { itemId?: string; date?: string; doneAt?: string }
    if (!isStr(b.itemId, 64) || !isStr(b.date, 10)) return error(400, 'Datos inválidos')
    if (method === 'PUT') {
      await env.DB.prepare('INSERT OR REPLACE INTO completions (user_id, item_id, date, done_at) VALUES (?, ?, ?, ?)')
        .bind(uid, b.itemId, b.date, isStr(b.doneAt, 40) ? b.doneAt : new Date().toISOString()).run()
    } else {
      await env.DB.prepare('DELETE FROM completions WHERE user_id = ? AND item_id = ? AND date = ?').bind(uid, b.itemId, b.date).run()
    }
    return json({ ok: true })
  }

  if (path === '/api/overrides' && (method === 'PUT' || method === 'DELETE')) {
    const b = (await req.json().catch(() => ({}))) as { itemId?: string; date?: string; movedTo?: string; skipped?: boolean }
    if (!isStr(b.itemId, 64) || !isStr(b.date, 10)) return error(400, 'Datos inválidos')
    if (method === 'PUT') {
      await env.DB.prepare('INSERT OR REPLACE INTO overrides (user_id, item_id, date, moved_to, skipped) VALUES (?, ?, ?, ?, ?)')
        .bind(uid, b.itemId, b.date, isStr(b.movedTo, 10) ? b.movedTo : null, b.skipped ? 1 : 0).run()
    } else {
      await env.DB.prepare('DELETE FROM overrides WHERE user_id = ? AND item_id = ? AND date = ?').bind(uid, b.itemId, b.date).run()
    }
    return json({ ok: true })
  }

  if (path === '/api/push/subscribe' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string }; timezone?: string }
    if (!isStr(b.endpoint, 1000) || !/^https:\/\//.test(b.endpoint) || !isStr(b.keys?.p256dh, 200) || !isStr(b.keys?.auth, 100)) return error(400, 'Suscripción inválida')
    const stmts = [
      env.DB.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, user_id, p256dh, auth) VALUES (?, ?, ?, ?)').bind(b.endpoint, uid, b.keys!.p256dh, b.keys!.auth),
    ]
    if (isStr(b.timezone, 64)) stmts.push(env.DB.prepare('UPDATE users SET timezone = ? WHERE id = ?').bind(b.timezone, uid))
    await env.DB.batch(stmts)
    return json({ ok: true })
  }

  if (path === '/api/push/unsubscribe' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { endpoint?: string }
    if (isStr(b.endpoint, 1000)) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(b.endpoint, uid).run()
    return json({ ok: true })
  }

  if (path === '/api/push/test' && method === 'POST') {
    const sent = await pushToUser(env, uid, {
      title: '¡Hola! Soy Agente X 🤖', body: 'Así te van a llegar los avisos de tus informes, tareas y reuniones.',
      tag: 'test', itemId: '', key: '', date: '', kind: 'task', actions: [],
    })
    return sent > 0 ? json({ ok: true, sent }) : error(400, 'Este usuario no tiene dispositivos con avisos activados')
  }

  if (path === '/api/profile' && method === 'PATCH') {
    const b = (await req.json().catch(() => ({}))) as { settings?: unknown; holidays?: unknown; onboarded?: boolean }
    const sets: string[] = []
    const vals: unknown[] = []
    if (b.settings !== undefined) { sets.push('settings = ?'); vals.push(JSON.stringify(b.settings)) }
    if (b.holidays !== undefined) {
      if (!Array.isArray(b.holidays) || b.holidays.length > 500) return error(400, 'Feriados inválidos')
      sets.push('holidays = ?'); vals.push(JSON.stringify(b.holidays))
    }
    if (b.onboarded !== undefined) { sets.push('onboarded = ?'); vals.push(b.onboarded ? 1 : 0) }
    if (sets.length) await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, uid).run()
    return json({ ok: true })
  }

  return error(404, 'No encontrado')
}

function vapid(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null
  return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: 'https://agente-x.aiannaci.workers.dev' }
}

/** Manda un aviso a todos los dispositivos del usuario. Devuelve cuántos lo recibieron. */
async function pushToUser(env: Env, uid: string, payload: NotificationPayload): Promise<number> {
  const keys = vapid(env)
  if (!keys) throw new Error('Faltan las claves VAPID')
  const { results } = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(uid).all<{ endpoint: string; p256dh: string; auth: string }>()
  let ok = 0
  for (const sub of results) {
    const r = await sendPush(sub, payload, keys).catch((e) => { console.error(e); return 'error' as const })
    if (r === 'ok') ok++
    if (r === 'gone') await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run()
  }
  return ok
}

/** Cada 5 minutos: revisa qué le toca a cada usuario y le manda los avisos pendientes. */
async function runReminders(env: Env) {
  if (!vapid(env)) return
  const { results: users } = await env.DB.prepare(
    'SELECT DISTINCT u.id, u.timezone FROM users u JOIN push_subscriptions p ON p.user_id = u.id',
  ).all<{ id: string; timezone: string | null }>()

  for (const u of users) {
    try {
      const data = await loadData(env, u.id)
      const now = localNow(u.timezone || 'America/Argentina/Buenos_Aires')
      const due = dueNotifications({
        items: data.items, completions: data.completions, overrides: data.overrides,
        holidays: data.holidays ?? DEFAULT_HOLIDAYS,
        settings: data.settings ?? { workStart: '08:00', workEnd: '17:00', workDays: [1, 2, 3, 4, 5] },
      }, now.date, now.minutes)
      if (!due.length) continue

      const { results: sent } = await env.DB.prepare(
        `SELECT key FROM notification_log WHERE user_id = ? AND key IN (${due.map(() => '?').join(',')})`,
      ).bind(u.id, ...due.map((d) => d.logKey)).all<{ key: string }>()
      const already = new Set(sent.map((r) => r.key))

      for (const d of due.filter((d) => !already.has(d.logKey))) {
        // Se registra antes de mandar: si algo falla, preferimos no repetir avisos.
        await env.DB.prepare('INSERT OR IGNORE INTO notification_log (user_id, key, sent_at) VALUES (?, ?, ?)').bind(u.id, d.logKey, Date.now()).run()
        await pushToUser(env, u.id, d.payload)
      }
    } catch (e) {
      console.error('reminders', u.id, e)
    }
  }
  await env.DB.prepare('DELETE FROM notification_log WHERE sent_at < ?').bind(Date.now() - 90 * 86400_000).run()
}

const decoded = new Map<string, Uint8Array>()

/** Sirve la app. Rutas desconocidas devuelven index.html (app de una sola página). */
function serveAsset(pathname: string): Response {
  const path = ASSETS[pathname] ? pathname : '/index.html'
  const asset = ASSETS[path]
  let body = decoded.get(path)
  if (!body) {
    body = Uint8Array.from(atob(asset.b64), (c) => c.charCodeAt(0))
    decoded.set(path, body)
  }
  const immutable = path.startsWith('/assets/')
  return new Response(body, {
    headers: {
      'content-type': asset.type,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(req, env, url.pathname)
      } catch (e) {
        console.error(e)
        return error(500, 'Error del servidor')
      }
    }
    return serveAsset(url.pathname)
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env))
  },
} satisfies ExportedHandler<Env>
