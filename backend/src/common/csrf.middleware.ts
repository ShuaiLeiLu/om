import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { randomToken } from './http'

const CSRF_COOKIE = 'chatty_csrf'
const CSRF_HEADER = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Routes exempt from CSRF enforcement.
 * - wechat/miniapp/*: bearer-token auth from the native miniprogram, no cookie involved
 *   (wx.request does not send cookies, so CSRF defense is moot and would just break login).
 * - health/*: liveness probes from infrastructure.
 * - auth/wechat/oauth/callback: 302 callback from WeChat servers (GET-only but exempted defensively).
 *
 * Patterns are matched substring-style against the full URL so they work whether or not the
 * NestJS global prefix ('/api') is included in the middleware's view of the path.
 */
const EXEMPT_PATTERNS = [
  '/wechat/miniapp/',
  '/health',
  '/auth/wechat/oauth/callback'
]

function isExempt(url: string) {
  // Strip query string before matching.
  const path = url.split('?')[0]
  return EXEMPT_PATTERNS.some((pattern) => path.includes(pattern))
}

/**
 * Double-submit cookie CSRF protection.
 * - On any request, ensure a `chatty_csrf` cookie exists (httpOnly: false so JS can read it).
 * - On state-changing requests, require the `X-CSRF-Token` header to match the cookie value.
 *   Since attacker pages can't read cross-site cookies, they can't forge a matching header.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const existing = req.cookies?.[CSRF_COOKIE]
    if (!existing) {
      const token = randomToken(24)
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      })
      req.cookies = { ...(req.cookies || {}), [CSRF_COOKIE]: token }
    }

    if (SAFE_METHODS.has(req.method) || isExempt(req.originalUrl || req.url || '')) {
      return next()
    }

    const cookie = req.cookies?.[CSRF_COOKIE]
    const header = req.get(CSRF_HEADER) || ''
    if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException('csrf_token_mismatch')
    }
    return next()
  }
}
