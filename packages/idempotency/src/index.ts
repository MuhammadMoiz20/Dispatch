import Redis from 'ioredis';
import hash from 'object-hash';
import { NextFunction, Request, Response } from 'express';

export type IdempotencyOptions = {
  redisUrl?: string;
  ttlSeconds?: number;
};

export function idempotencyMiddleware(opts: IdempotencyOptions = {}) {
  const redis = new Redis(opts.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  const ttl = opts.ttlSeconds ?? 60 * 60 * 24; // 24h

  return async function (req: Request, res: Response, next: NextFunction) {
    const keyHeader = req.header('Idempotency-Key');
    if (!keyHeader) return next();

    const tenant = (res as any).locals?.tenant_id || 'unknown';
    const route = req.baseUrl + req.path;
    const fingerprint = hash({ body: req.body, route });
    const key = `idemp:${tenant}:${route}:${keyHeader}`;

    const existing = await redis.get(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.request_hash !== fingerprint) {
        return res.status(409).json({ error: 'Idempotency key re-use with different payload' });
      }
      return res.status(parsed.status).set(parsed.headers || {}).send(parsed.body);
    }

    const originalSend = res.send.bind(res);
    res.send = ((body?: any) => {
      const status = res.statusCode;
      const headers: Record<string, string> = {};
      // snapshot minimal headers; extend as needed
      ['content-type'].forEach((h) => {
        const v = res.getHeader(h);
        if (typeof v === 'string') headers[h] = v;
      });
      void redis.set(
        key,
        JSON.stringify({ status, body, headers, request_hash: fingerprint }),
        'EX',
        ttl,
      );
      return originalSend(body);
    }) as any;

    return next();
  };
}

