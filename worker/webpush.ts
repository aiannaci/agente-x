/**
 * Envío de notificaciones Web Push sin dependencias (WebCrypto):
 * - Cifrado del mensaje según RFC 8291 (aes128gcm).
 * - Autenticación del servidor con VAPID (RFC 8292, JWT ES256).
 */

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string // clave pública del navegador, base64url (65 bytes)
  auth: string // secreto de autenticación, base64url (16 bytes)
}

export interface VapidKeys {
  publicKey: string // base64url, 65 bytes sin comprimir
  privateKey: string // base64url, 32 bytes (d)
  subject: string // URL o mailto de contacto
}

const enc = new TextEncoder()

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

/** Clave privada ECDSA/ECDH P-256 a partir de d (32 bytes) y la pública (65 bytes). */
function p256Jwk(publicRaw: Uint8Array, d?: Uint8Array): JsonWebKey {
  return {
    kty: 'EC', crv: 'P-256',
    x: b64urlEncode(publicRaw.slice(1, 33)),
    y: b64urlEncode(publicRaw.slice(33, 65)),
    ...(d ? { d: b64urlEncode(d) } : {}),
    ext: true,
  }
}

/**
 * Cifra el contenido para una suscripción (RFC 8291).
 * `sender` y `salt` solo se pasan en pruebas; en uso normal se generan al azar.
 */
export async function encryptPayload(
  payload: Uint8Array,
  sub: { p256dh: string; auth: string },
  opts: { sender?: CryptoKeyPair; salt?: Uint8Array } = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh)
  const authSecret = b64urlDecode(sub.auth)
  const sender = opts.sender ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, sender.privateKey, 256))

  const prkKey = await hmac(authSecret, ecdhSecret)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]))
  const ikm = (await hmac(prkKey, keyInfo)).slice(0, 32)

  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, enc.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16)
  const nonce = (await hmac(prk, enc.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const plaintext = concat(payload, new Uint8Array([2])) // delimitador del último registro
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plaintext))

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** Encabezado Authorization con el JWT VAPID firmado (ES256). */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub: vapid.subject })))
  const key = await crypto.subtle.importKey('jwk', p256Jwk(b64urlDecode(vapid.publicKey), b64urlDecode(vapid.privateKey)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)))
  return `vapid t=${header}.${claims}.${b64urlEncode(sig)}, k=${vapid.publicKey}`
}

export type PushResult = 'ok' | 'gone' | 'error'

/** Envía una notificación. 'gone' = la suscripción ya no existe y hay que borrarla. */
export async function sendPush(sub: PushSubscriptionKeys, data: unknown, vapid: VapidKeys, ttl = 3600): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(JSON.stringify(data)), sub)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
    },
    body,
  })
  if (res.status === 404 || res.status === 410) return 'gone'
  if (!res.ok) {
    console.error('push error', res.status, await res.text().catch(() => ''))
    return 'error'
  }
  return 'ok'
}
