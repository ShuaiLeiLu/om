import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { json, urlencoded } from 'express'
import cookieParser from 'cookie-parser'
import { BigIntInterceptor } from './common/bigint.interceptor'
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
  // Image-edit payloads can contain up to 16 reference images as base64 data URLs.
  // 200 MB upper bound covers the worst case (16 × ~12 MB).
  app.use(json({ limit: '200mb' }))
  app.use(urlencoded({ limit: '200mb', extended: true }))
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalInterceptors(new BigIntInterceptor())
  const port = Number(process.env.PORT || 3001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
