import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
// Avoid background timers during tests that keep Jest open
if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ register: registry });
}

export const webhookRetryTotal = new Counter({
  name: 'webhook_retry_total',
  help: 'Total number of webhook retries scheduled',
  registers: [registry],
});

export const webhookSuccessGauge = new Gauge({
  name: 'webhook_success_rate',
  help: 'Ratio of successful webhook deliveries (0..1)',
  registers: [registry],
});

export const dlqDepthGauge = new Gauge({
  name: 'dlq_depth',
  help: 'Number of dead-lettered webhook deliveries',
  registers: [registry],
});

// Internal counters to derive success rate
export const successTotal = new Counter({
  name: 'webhook_success_total',
  help: 'Total successful webhook deliveries',
  registers: [registry],
});

export const failureTotal = new Counter({
  name: 'webhook_failure_total',
  help: 'Total failed webhook deliveries (non-retryable)',
  registers: [registry],
});

export const eventsPublishedTotal = new Counter({
  name: 'events_published_total',
  help: 'Total number of domain events published to broker',
  labelNames: ['type'] as const,
  registers: [registry],
});

export function updateSuccessRateGauge() {
  const succ = (successTotal as any).hashMap?.['']?.value || 0;
  const fail = (failureTotal as any).hashMap?.['']?.value || 0;
  const denom = succ + fail;
  webhookSuccessGauge.set(denom > 0 ? succ / denom : 0);
}

@Controller('/metrics')
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', registry.contentType);
    return res.send(await registry.metrics());
  }
}
