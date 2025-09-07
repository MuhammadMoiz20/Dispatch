import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { Controller, Get } from '@nestjs/common';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'users' };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const config = loadConfig({ SERVICE_NAME: 'users' });
  const app = await NestFactory.create(AppModule);
  app.use(httpLogger());
  app.use(idempotencyMiddleware());

  await app.listen(process.env.PORT || config.PORT || 4001);
  Logger.log(`users service listening on :${process.env.PORT || config.PORT || 4001}`);
}

bootstrap();

