import pino, { Logger, LoggerOptions } from 'pino';
import pinoHttp from 'pino-http';

export function createLogger(options?: LoggerOptions): Logger {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    ...options,
  });
}

export function httpLogger() {
  return pinoHttp({
    customProps: (_req, res) => ({ tenant_id: (res as any).locals?.tenant_id }),
  });
}

