import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total number of auth attempts',
  labelNames: ['op'] as const,
  registers: [registry],
});

export const authSuccessTotal = new Counter({
  name: 'auth_success_total',
  help: 'Total number of successful auth operations',
  labelNames: ['op'] as const,
  registers: [registry],
});

export const authFailuresTotal = new Counter({
  name: 'auth_failures_total',
  help: 'Total number of failed auth operations',
  labelNames: ['op', 'reason'] as const,
  registers: [registry],
});

@Controller('/metrics')
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', registry.contentType);
    return res.send(await registry.metrics());
  }
}

