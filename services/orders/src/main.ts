import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module, Controller, Get } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { idempotencyMiddleware } from '@dispatch/idempotency';
import { PrismaService } from './prisma.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { MetricsController } from './metrics.controller';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'orders' };
  }
}

@Module({ controllers: [HealthController, OrdersController, MetricsController], providers: [PrismaService, OrdersService] })
class AppModule {}

async function bootstrap() {
  const config = loadConfig({ SERVICE_NAME: 'orders' });
  const app = await NestFactory.create(AppModule);
  app.use(httpLogger());
  // Attach tenant to res.locals if Authorization exists for idempotency scoping
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.header('authorization');
      if (auth) {
        const [scheme, token] = auth.split(' ');
        if (scheme?.toLowerCase() === 'bearer' && token) {
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

  await app.listen(process.env.PORT || config.PORT || 4002);
  Logger.log(`orders service listening on :${process.env.PORT || config.PORT || 4002}`);
}

bootstrap();
