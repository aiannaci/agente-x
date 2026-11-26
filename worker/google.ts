/** Verificación del ID token (JWT) que entrega "Iniciar sesión con Google". */

interface Jwk { kid: string; n: string; e: string; kty: string; alg: string }
let cache: { keys: Jwk[]; until: number } | null = null

async function googleKeys(): Promise<Jwk[]> {
  if (cache && cache.until > Date.now()) return cache.keys
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs')
  if (!res.ok) throw new Error('No se pudieron obtener las claves de Google')
  const { keys } = (await res.json()) as { keys: Jwk[] }
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600)
  cache = { keys, until: Date.now() + maxAge * 1000 }
  return keys
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export interface GoogleProfile {
  sub: string
  email: string
  name?: string
  picture?: string
}

export async function verifyGoogleIdToken(token: string, clientId: string): Promise<GoogleProfile> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Token inválido')
  const [h, p, s] = parts
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)))

  const jwk = (await googleKeys()).find((k) => k.kid === header.kid)
  if (!jwk || header.alg !== 'RS256') throw new Error('Clave de firma desconocida')
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) throw new Error('Firma inválida')

  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== clientId) throw new Error('Token emitido para otra app')
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') throw new Error('Emisor inválido')
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new Error('Token vencido')
  if (!payload.email || payload.email_verified === false) throw new Error('Email no verificado')

  return { sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: payload.name, picture: payload.picture }
}
