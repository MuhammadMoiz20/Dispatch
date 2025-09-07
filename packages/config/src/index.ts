import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  POSTGRES_URL: z.string().url().optional(),
  REDIS_URL: z.string().optional(),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),
  SERVICE_NAME: z.string().default('unknown'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(overrides?: Partial<NodeJS.ProcessEnv>): AppConfig {
  const parsed = ConfigSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return parsed.data;
}

