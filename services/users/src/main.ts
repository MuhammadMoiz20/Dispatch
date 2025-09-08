import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { initTelemetry } from '@dispatch/telemetry';
import { AuthController } from './auth.controller';
import { DevicesController } from './devices.controller';
import { AuthService } from './auth.service';
import { MetricsController } from './metrics.controller';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'users' };
  }
}

@Module({ controllers: [HealthController, AuthController, DevicesController, MetricsController], providers: [PrismaService, AuthService] })
class AppModule {}

async function bootstrap() {
  // Initialize OpenTelemetry (no-op if deps not installed)
  initTelemetry('users');
  const config = loadConfig({ SERVICE_NAME: 'users' });
  const app = await NestFactory.create(AppModule);
  app.use(httpLogger());
  app.use(idempotencyMiddleware());

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  await app.listen(process.env.PORT || config.PORT || 4001);
  Logger.log(`users service listening on :${process.env.PORT || config.PORT || 4001}`);
}

bootstrap();
