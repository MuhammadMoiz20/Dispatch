import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ register: registry });
}

export const subscriptionClientsGauge = new Gauge({
  name: 'subscription_clients_gauge',
  help: 'Number of active GraphQL subscription clients',
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

