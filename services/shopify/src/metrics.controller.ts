import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
if (process.env.NODE_ENV !== 'test') collectDefaultMetrics({ register: registry });

export const ordersWebhooksReceived = new Counter({
  name: 'shopify_orders_webhooks_total',
  help: 'Total Shopify orders webhooks received',
  registers: [registry],
});

export const connectionsGauge = new Gauge({
  name: 'shopify_connections_gauge',
  help: 'Number of active Shopify connections',
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
