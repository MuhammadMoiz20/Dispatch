import hash from 'object-hash';
import { NextFunction, Request, Response } from 'express';

export type IdempotencyOptions = {
  redisUrl?: string;
  ttlSeconds?: number;
};

export function idempotencyMiddleware(opts: IdempotencyOptions = {}) {
  // Resolve ioredis dynamically so test mocks can intercept and to avoid top-level connection attempts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Redis = require('ioredis');
  const redis = new Redis(opts.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  const ttl = opts.ttlSeconds ?? 60 * 60 * 24; // 24h

  return async function (req: Request, res: Response, next: NextFunction) {
    const keyHeader = req.header('Idempotency-Key');
    if (!keyHeader) return next();

    const tenant = (res as any).locals?.tenant_id || 'unknown';
    const route = req.baseUrl + req.path;

    // Ensure we have a parsed JSON body if applicable, even when this middleware
    // is registered before body-parser (as in some test setups). If we parse it
    // ourselves, mark _body so downstream body-parsers will skip re-reading.
    const method = (req.method || 'GET').toUpperCase();
    const hasJson = (req.headers['content-type'] || '').toString().includes('application/json');
    const needsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && hasJson;

    let ensuredBody: unknown = req.body;
    if (needsBody && (ensuredBody === undefined || ensuredBody === null)) {
      try {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
          req.on('end', () => resolve());
          req.on('error', reject);
        });
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          ensuredBody = raw ? JSON.parse(raw) : {};
        } catch {
          ensuredBody = {};
        }
        // Provide parsed body to downstream consumers and signal body-parser to skip
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).body = ensuredBody;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any)._body = true;
      } catch {
        // If we cannot read the body, fall back to whatever is present
        ensuredBody = req.body;
      }
    }

    const fingerprint = hash({ body: ensuredBody, route });
    const key = `idemp:${tenant}:${route}:${keyHeader}`;

    let existing: string | null = null;
    try {
      existing = await redis.get(key);
    } catch {
      // Redis unavailable: gracefully skip idempotency rather than erroring the request
      existing = null;
    }
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.request_hash !== fingerprint) {
        return res.status(409).json({ error: 'Idempotency key re-use with different payload' });
      }
      const statusToReturn = parsed.status === 201 ? 200 : parsed.status;
      // Signal that this response is a replay from idempotency cache
      res.setHeader('Idempotency-Replayed', 'true');
      return res
        .status(statusToReturn)
        .set(parsed.headers || {})
        .send(parsed.body);
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
      // Best-effort cache write; never block or throw
      Promise.resolve(
        redis.set(
          key,
          JSON.stringify({ status, body, headers, request_hash: fingerprint }),
          'EX',
          ttl,
        ),
      ).catch(() => {});
      return originalSend(body);
    }) as any;

    return next();
  };
}
