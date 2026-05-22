import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import cookieParser from 'cookie-parser'
import { BigIntInterceptor } from './common/bigint.interceptor'
import { GlobalErrorFilter } from './common/error.filter'
import { AppModule } from './modules/app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      credentials: true,
      origin(origin, callback) {
        const allowed = new Set([
          process.env.APP_ORIGIN || 'http://localhost:3000',
          'http://localhost:3000',
          'http://127.0.0.1:3000'
        ])
        if (!origin || allowed.has(origin)) callback(null, true)
        else callback(null, false)
      }
    }
  })
  app.setGlobalPrefix('api')
  // Reference-image uploads now go through multipart on /api/images/edits, so the
  // JSON limit can stay tight. 50mb still tolerates legacy base64 callers sending
  // 1–2 small reference images while rejecting abusive payloads outright.
  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ limit: '50mb', extended: true }))
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalInterceptors(new BigIntInterceptor())
  app.useGlobalFilters(new GlobalErrorFilter())
  const port = Number(process.env.PORT || 3001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
