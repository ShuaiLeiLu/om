import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { BigIntInterceptor } from './common/bigint.interceptor'
import { AppModule } from './modules/app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false })
  app.setGlobalPrefix('api')
  app.use(cookieParser())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.useGlobalInterceptors(new BigIntInterceptor())
  const port = Number(process.env.PORT || 3001)
  await app.listen(port, '0.0.0.0')
}

void bootstrap()
