'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.idempotencyMiddleware = idempotencyMiddleware;
const object_hash_1 = __importDefault(require('object-hash'));
function idempotencyMiddleware(opts = {}) {
  // Resolve ioredis dynamically so test mocks can intercept and to avoid top-level connection attempts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Redis = require('ioredis');
  const redis = new Redis(opts.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  const ttl = opts.ttlSeconds ?? 60 * 60 * 24; // 24h
  return async function (req, res, next) {
    const keyHeader = req.header('Idempotency-Key');
    if (!keyHeader) return next();
    const tenant = res.locals?.tenant_id || 'unknown';
    const route = req.baseUrl + req.path;
    // Ensure parsed JSON body even if middleware runs before body-parser
    const method = (req.method || 'GET').toUpperCase();
    const hasJson = (req.headers['content-type'] || '').toString().includes('application/json');
    const needsBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && hasJson;
    let ensuredBody = req.body;
    if (needsBody && (ensuredBody === undefined || ensuredBody === null)) {
      try {
        const chunks = [];
        await new Promise((resolve, reject) => {
          req.on('data', (c) => chunks.push(Buffer.from(c)));
          req.on('end', () => resolve());
          req.on('error', reject);
        });
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          ensuredBody = raw ? JSON.parse(raw) : {};
        } catch {
          ensuredBody = {};
        }
        req.body = ensuredBody;
        req._body = true;
      } catch {
        ensuredBody = req.body;
      }
    }
    const fingerprint = (0, object_hash_1.default)({ body: ensuredBody, route });
    const key = `idemp:${tenant}:${route}:${keyHeader}`;
    let existing = null;
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
      res.setHeader('Idempotency-Replayed', 'true');
      return res
        .status(statusToReturn)
        .set(parsed.headers || {})
        .send(parsed.body);
    }
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      const status = res.statusCode;
      const headers = {};
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
    };
    return next();
  };
}
