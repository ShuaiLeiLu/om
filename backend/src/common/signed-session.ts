import { createHmac, timingSafeEqual } from 'crypto'

export type SignedSessionKind = 'user' | 'admin'

export type SignedSessionPayload = {
  typ: SignedSessionKind
  sub: string
  exp: number
  nonce: string
}

export function signSession(payload: SignedSessionPayload, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySession(token: string | undefined, secret: string, kind: SignedSessionKind) {
  if (!token || !secret) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  if (!safeEqual(sig, expected)) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SignedSessionPayload>
  if (payload.typ !== kind || !payload.sub || typeof payload.exp !== 'number') return null
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload as SignedSessionPayload
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
