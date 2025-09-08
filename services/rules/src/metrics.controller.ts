import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
// Avoid background timers during tests that keep Jest open
if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ register: registry });
}

export const ruleEvalDuration = new Histogram({
  name: 'rule_eval_duration_ms',
  help: 'Time taken to evaluate ruleset in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
  registers: [registry],
});

export const ruleActionsTotal = new Counter({
  name: 'rule_actions_total',
  help: 'Total number of rule actions executed',
  labelNames: ['action'] as const,
  registers: [registry],
});

export const eventsPublishedTotal = new Counter({
  name: 'events_published_total',
  help: 'Total number of domain events published to broker',
  labelNames: ['type'] as const,
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
