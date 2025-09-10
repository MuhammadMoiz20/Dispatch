import { Controller, Get, Res } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import type { Response } from 'express';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const etlIngestTotal = new Counter({
  name: 'etl_ingest_total',
  help: 'Total number of ingested events',
  labelNames: ['type'] as const,
  registers: [registry],
});

export const etlErrorsTotal = new Counter({
  name: 'etl_errors_total',
  help: 'Total number of ETL errors',
  labelNames: ['stage'] as const,
  registers: [registry],
});

export const chWriteLatencyMs = new Histogram({
  name: 'ch_write_latency_ms',
  help: 'Latency of ClickHouse writes in ms',
  buckets: [5, 10, 20, 50, 100, 250, 500, 1000, 2500],
  registers: [registry],
});

export const etlLagSeconds = new Gauge({
  name: 'etl_lag_seconds',
  help: 'Ingest lag (now - event_time) in seconds for last processed event',
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
