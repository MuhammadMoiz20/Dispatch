"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const zod_1 = require("zod");
const ConfigSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().default(3000),
    POSTGRES_URL: zod_1.z.string().url().optional(),
    REDIS_URL: zod_1.z.string().optional(),
    RABBITMQ_URL: zod_1.z.string().default('amqp://localhost:5672'),
    SERVICE_NAME: zod_1.z.string().default('unknown'),
});
function loadConfig(overrides) {
    const parsed = ConfigSchema.safeParse({ ...process.env, ...overrides });
    if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new Error(`Invalid configuration: ${issues}`);
    }
    return parsed.data;
}
