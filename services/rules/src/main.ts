import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Controller, Get, Logger, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { MetricsController } from './metrics.controller';
import { OutboxWorker } from './outbox.worker';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { initTelemetry } from '@dispatch/telemetry';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

@Controller('/health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'rules' };
  }
}

@Module({ controllers: [HealthController, RulesController, MetricsController], providers: [PrismaService, RulesService, OutboxWorker] })
class AppModule {}

async function bootstrap() {
  // Initialize OpenTelemetry (no-op if deps not installed)
  initTelemetry('rules');
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    maxAge: 3600,
  });
  app.use(httpLogger());
  // Attach tenant to res.locals for idempotency scoping
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.header('authorization');
      if (auth) {
        const [scheme, token] = auth.split(' ');
        if ((scheme || '').toLowerCase() === 'bearer' && token) {
          const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          if (decoded?.tenantId) (res as any).locals = { ...(res as any).locals, tenant_id: decoded.tenantId };
        }
      }
    } catch {}
    next();
  });
  app.use(idempotencyMiddleware());
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);
  await app.listen(process.env.PORT || 4004);
  Logger.log(`rules service listening on :${process.env.PORT || 4004}`);
}

bootstrap();
