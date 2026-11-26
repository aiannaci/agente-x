import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createECDH, randomBytes } from 'node:crypto'
import { encryptPayload, vapidAuthorization, b64urlEncode, b64urlDecode } from './webpush'

const require = createRequire(import.meta.url)
// Implementación de referencia (usada por la librería web-push de Node) para descifrar.
const ece = require('http_ece')

describe('web push', () => {
  it('el navegador puede descifrar el mensaje (RFC 8291)', async () => {
    const browser = createECDH('prime256v1')
    browser.generateKeys()
    const auth = randomBytes(16)
    const message = JSON.stringify({ title: 'Hoy te toca enviar', body: 'Facturas bloqueadas ñ ✓' })

    const body = await encryptPayload(new TextEncoder().encode(message), {
      p256dh: b64urlEncode(browser.getPublicKey()),
      auth: b64urlEncode(auth),
    })

    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: browser, authSecret: auth })
    expect(plain.toString('utf8')).toBe(message)
  })

  it('firma VAPID válida', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', {
      publicKey: b64urlEncode(pub), privateKey: jwk.d!, subject: 'https://agente-x.example',
    }, 1_700_000_000)

    const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!
    expect(k).toBe(b64urlEncode(pub))
    const [h, c, s] = jwt.split('.')
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)))
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_700_000_000 + 43200, sub: 'https://agente-x.example' })
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
  })
})
