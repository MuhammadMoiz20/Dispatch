import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

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

@Controller('/metrics')
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', registry.contentType);
    return res.send(await registry.metrics());
  }
}
