"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.idempotencyMiddleware = idempotencyMiddleware;
const ioredis_1 = __importDefault(require("ioredis"));
const object_hash_1 = __importDefault(require("object-hash"));
function idempotencyMiddleware(opts = {}) {
    const redis = new ioredis_1.default(opts.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    const ttl = opts.ttlSeconds ?? 60 * 60 * 24; // 24h
    return async function (req, res, next) {
        const keyHeader = req.header('Idempotency-Key');
        if (!keyHeader)
            return next();
        const tenant = res.locals?.tenant_id || 'unknown';
        const route = req.baseUrl + req.path;
        const fingerprint = (0, object_hash_1.default)({ body: req.body, route });
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
        res.send = ((body) => {
            const status = res.statusCode;
            const headers = {};
            // snapshot minimal headers; extend as needed
            ['content-type'].forEach((h) => {
                const v = res.getHeader(h);
                if (typeof v === 'string')
                    headers[h] = v;
            });
            void redis.set(key, JSON.stringify({ status, body, headers, request_hash: fingerprint }), 'EX', ttl);
            return originalSend(body);
        });
        return next();
    };
}
