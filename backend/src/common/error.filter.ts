import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'

/**
 * Global error filter that:
 * - Forwards HttpException payloads as-is (services already return stable error codes like
 *   'invalid_credentials', 'tokens_too_large').
 * - In production, replaces unexpected errors with an opaque 'internal_error' instead of
 *   leaking stack traces or upstream error messages.
 */
@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalErrorFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      res.status(status).json(typeof payload === 'string' ? { message: payload } : payload)
      return
    }

    const isProd = process.env.NODE_ENV === 'production'
    const err = exception as { message?: string; stack?: string }
    this.logger.error(err?.message || 'unknown_error', err?.stack)

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: isProd ? 'internal_error' : err?.message || 'internal_error'
    })
  }
}
