import { createHash, randomBytes } from 'crypto'
import { Request } from 'express'

export function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function getClientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  return req.ip || ''
}

export function getUserAgent(req: Request) {
  return String(req.headers['user-agent'] || '')
}

export function toPublicBigInt(value: bigint | number | string) {
  return value.toString()
}

export function nowPlusSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000)
}
