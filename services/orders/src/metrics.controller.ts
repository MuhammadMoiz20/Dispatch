import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
// Avoid background timers during tests that keep Jest open
if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ register: registry });
}

export const ordersIngestedTotal = new Counter({
  name: 'orders_ingested_total',
  help: 'Total number of orders ingested',
  registers: [registry],
});

export const listLatency = new Histogram({
  name: 'orders_list_latency_seconds',
  help: 'Latency of listing orders',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

export const returnsInitiatedTotal = new Counter({
  name: 'returns_initiated_total',
  help: 'Total number of returns initiated',
  registers: [registry],
});

export const labelsGeneratedTotal = new Counter({
  name: 'labels_generated_total',
  help: 'Total number of shipping labels generated',
  labelNames: ['carrier'],
  registers: [registry],
});

export const labelGenerationDurationMs = new Histogram({
  name: 'label_generation_duration_ms',
  help: 'Label generation duration in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000],
  registers: [registry],
});

export const eventsPublishedTotal = new Counter({
  name: 'events_published_total',
  help: 'Total number of domain events published to broker',
  labelNames: ['type'] as const,
  registers: [registry],
});

// Refund metrics
export const refundsTotal = new Counter({
  name: 'refunds_total',
  help: 'Total number of refunds, partitioned by status',
  labelNames: ['status'] as const, // pending|succeeded|failed
  registers: [registry],
});

export const refundLatencyMs = new Histogram({
  name: 'refund_latency_ms',
  help: 'Refund execution latency in milliseconds',
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
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
