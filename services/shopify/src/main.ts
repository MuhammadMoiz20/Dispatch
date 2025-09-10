import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module, Controller, Get } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { PrismaService } from './prisma.service';
import { ShopifyController } from './shopify.controller';
import { MetricsController } from './metrics.controller';
import { initTelemetry } from '@dispatch/telemetry';
import express from 'express';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'shopify' };
  }
}

@Module({
  controllers: [HealthController, ShopifyController, MetricsController],
  providers: [PrismaService],
})
class AppModule {}

async function bootstrap() {
  initTelemetry('shopify');
  const config = loadConfig({ SERVICE_NAME: 'shopify' });
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 3600,
    },
  });
  app.use(httpLogger());
  app.use(idempotencyMiddleware());
  // Use raw body for Shopify webhooks to verify HMAC signatures
  app.use('/v1/shopify/webhooks', express.raw({ type: '*/*' }));
  // Use JSON body parser for other routes
  app.use(express.json());
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);
  await app.listen(process.env.PORT || config.PORT || 4005);
  Logger.log(`shopify service listening on :${process.env.PORT || config.PORT || 4005}`);
}

bootstrap();
