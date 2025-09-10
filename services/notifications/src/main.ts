import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, Module, Controller, Get } from '@nestjs/common';
import { loadConfig } from '@dispatch/config';
import { httpLogger } from '@dispatch/logger';
import { PrismaService } from './prisma.service';
import { TemplatesController } from './templates.controller';
import { PreferencesController } from './preferences.controller';
import { NotificationsController } from './notifications.controller';
import { ProviderWebhooksController } from './provider-webhooks.controller';
import jwt from 'jsonwebtoken';
import { initTelemetry } from '@dispatch/telemetry';
import type { Request, Response, NextFunction } from 'express';

@Controller('/health')
class HealthController {
  @Get()
  get() {
    return { status: 'ok', service: 'notifications' };
  }
}

@Module({
  controllers: [
    HealthController,
    TemplatesController,
    PreferencesController,
    NotificationsController,
    ProviderWebhooksController,
  ],
  providers: [PrismaService],
})
class AppModule {}

async function bootstrap() {
  initTelemetry('notifications');
  const config = loadConfig({ SERVICE_NAME: 'notifications' });
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 3600,
    },
  });
  app.use(httpLogger());
  // Attach tenant to res.locals if Authorization exists
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.header('authorization');
      if (auth) {
        const [scheme, token] = auth.split(' ');
        if (scheme?.toLowerCase() === 'bearer' && token) {
          const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
          if (decoded?.tenantId)
            (res as any).locals = {
              ...(res as any).locals,
              tenant_id: decoded.tenantId,
              role: decoded?.role,
            };
        }
      }
    } catch (err) {
      // Ignore JWT parsing errors; downstream routes may still work
    }
    next();
  });

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = Number(process.env.PORT || config.PORT || 4006);
  await app.listen(port);
  Logger.log(`notifications service listening on :${port}`);
}

bootstrap();
