import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module, Controller, Get } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { PrismaService } from './prisma.service';
import { OrdersController } from './orders.controller';
import { ReturnsController } from './returns.controller';
import { LabelsController } from './labels.controller';
import { RatesController } from './rates.controller';
import { RefundsController } from './refunds.controller';
import { OrdersService } from './orders.service';
import { OutboxWorker } from './outbox.worker';
import { RefundsWorker } from './refunds.worker';
import { ProviderWebhooksController } from './provider-webhooks.controller';
import { MetricsController } from './metrics.controller';
import jwt from 'jsonwebtoken';
import { initTelemetry } from '@dispatch/telemetry';
import type { Request, Response, NextFunction } from 'express';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'orders' };
  }
}

@Module({
  controllers: [
    HealthController,
    OrdersController,
    ReturnsController,
    LabelsController,
    RatesController,
    RefundsController,
    ProviderWebhooksController,
    MetricsController,
  ],
  providers: [PrismaService, OrdersService, OutboxWorker, RefundsWorker],
})
class AppModule {}

async function bootstrap() {
  // Initialize OpenTelemetry (no-op if deps not installed)
  initTelemetry('orders');
  const config = loadConfig({ SERVICE_NAME: 'orders' });
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      maxAge: 3600,
    },
  });
  app.use(httpLogger());
  // Attach tenant to res.locals if Authorization exists for idempotency scoping
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.header('authorization');
      if (auth) {
        const [scheme, token] = auth.split(' ');
        if (scheme?.toLowerCase() === 'bearer' && token) {
          const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          if (decoded?.tenantId)
            (res as any).locals = { ...(res as any).locals, tenant_id: decoded.tenantId };
        }
      }
    } catch {}
    next();
  });
  // Pre-idempotency: derive tenant for returns POST using orderId in body
  const prisma = app.get(PrismaService);
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.method === 'POST' && req.path === '/v1/returns' && (req as any).body?.orderId) {
        const order = await (prisma as any).order.findUnique({
          where: { id: (req as any).body.orderId },
          select: { tenantId: true },
        });
        if (order?.tenantId)
          (res as any).locals = { ...(res as any).locals, tenant_id: order.tenantId };
      }
    } catch {}
    next();
  });
  app.use(idempotencyMiddleware());
  await prisma.enableShutdownHooks(app);

  await app.listen(process.env.PORT || config.PORT || 4002);
  Logger.log(`orders service listening on :${process.env.PORT || config.PORT || 4002}`);
}

bootstrap();
