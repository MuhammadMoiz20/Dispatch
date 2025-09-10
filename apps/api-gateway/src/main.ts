import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import { initTelemetry } from '@dispatch/telemetry';
import { loadConfig } from '@dispatch/config';
import type { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

async function bootstrap() {
  // Initialize OpenTelemetry (no-op if deps not installed)
  initTelemetry('api-gateway');
  const config = loadConfig({ SERVICE_NAME: 'api-gateway' });
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
  // Basic Redis fixed-window rate limiter (60 sec)
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redis = new Redis(redisUrl);
      const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 600);
      app.use(async (req: Request, res: Response, next: NextFunction) => {
        try {
          const auth = req.headers['authorization'] as string | undefined;
          const apiKeyHdr = req.headers['x-api-key'] as string | undefined;
          let tenantId: string | undefined;
          if (auth && auth.startsWith('Bearer ')) {
            try {
              const decoded: any = jwt.verify(
                auth.split(' ')[1],
                process.env.JWT_SECRET || 'dev-secret',
              );
              tenantId = decoded?.tenantId;
            } catch (err) {
              // Ignore JWT parse/verify errors for rate limiting context
            }
          }
          // If using API key via header, parse prefix from Authorization: ApiKey <prefix.secret> or X-API-Key
          let apiKeyPrefix: string | undefined;
          if (auth && auth.startsWith('ApiKey ')) {
            apiKeyPrefix = (auth.split(' ')[1] || '').split('.')[0];
          } else if (apiKeyHdr) {
            apiKeyPrefix = (apiKeyHdr || '').split('.')[0];
          }
          const id = apiKeyPrefix ? `k:${apiKeyPrefix}` : tenantId ? `t:${tenantId}` : 'anon';
          const window = Math.floor(Date.now() / 60000);
          const key = `rl:${id}:${window}`;
          const current = await redis.incr(key);
          if (current === 1) await redis.expire(key, 65);
          if (current > limit) {
            res.status(429).json({ message: 'Rate limit exceeded' });
            return;
          }
        } catch (err) {
          // Non-fatal rate limiter middleware error
        }
        next();
      });
    }
  } catch (err) {
    // Ignore Redis initialization failures; API still functions without rate limiting
  }
  await app.listen(config.PORT);
  Logger.log(`api-gateway listening on :${config.PORT}`);
}

bootstrap();
