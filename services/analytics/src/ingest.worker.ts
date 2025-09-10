import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createRabbitMQ } from '@dispatch/messaging';
import { insertEvents, query } from './clickhouse';
import {
  chWriteLatencyMs,
  etlErrorsTotal,
  etlIngestTotal,
  etlLagSeconds,
} from './metrics.controller';
import { ensureSpoolDir, readBatch, removeFile, writeSpool } from './spool';

type BaseEvent = { tenantId: string; at?: string } & Record<string, any>;

@Injectable()
export class IngestWorker implements OnModuleInit {
  private logger = new Logger('AnalyticsIngest');
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  private dedupe = new Map<string, number>();
  private dedupeTtlMs = 60 * 60 * 1000; // 1h
  private lastPrune = Date.now();

  async onModuleInit() {
    ensureSpoolDir();
    await this.safeSubscribe('order.created', (m) => this.handleOrderCreated(m));
    await this.safeSubscribe('return.initiated', (m) => this.handleReturnInitiated(m));
    await this.safeSubscribe('return.state_changed', (m) => this.handleReturnStateChanged(m));
    await this.safeSubscribe('return.label_generated', (m) => this.handleReturnLabelGenerated(m));
    await this.safeSubscribe('refund.executed', (m) => this.handleRefundExecuted(m));
    await this.safeSubscribe('webhook.delivery_updated', (m) =>
      this.handleWebhookDeliveryUpdated(m),
    );
    // Periodically drain spool
    setInterval(
      () =>
        void this.drainSpool().catch((e) =>
          this.logger.warn(`spool drain error: ${e?.message || e}`),
        ),
      5000,
    );
  }

  private async safeSubscribe(queue: string, handler: (m: any) => Promise<void>) {
    try {
      await this.mq.subscribe<any>(queue, async (msg) => {
        try {
          await handler(msg);
          etlIngestTotal.inc({ type: queue });
        } catch (err: any) {
          this.logger.error(`handler error for ${queue}: ${err?.message || err}`);
          etlErrorsTotal.inc({ stage: `handler:${queue}` });
        }
      });
      this.logger.log(`Subscribed to ${queue}`);
    } catch (e: any) {
      this.logger.warn(`Failed to subscribe ${queue}: ${e?.message || e}`);
    }
  }

  private nowIso() {
    return new Date().toISOString();
  }

  private toDateTime(at?: string) {
    return at && !Number.isNaN(Date.parse(at)) ? new Date(at) : new Date();
  }

  private async approvalLatencyMs(returnId: string, labelAt?: string): Promise<number | undefined> {
    try {
      const rows = await query<{ t: string }>(
        `SELECT toString(max(event_time)) AS t FROM analytics.events_raw WHERE event_type = 'return.initiated' AND return_id = {rid:String} LIMIT 1`,
        { rid: returnId },
      );
      const initiatedAt = rows[0]?.t;
      if (!initiatedAt) return undefined;
      const start = new Date(initiatedAt).getTime();
      const end = this.toDateTime(labelAt).getTime();
      return Math.max(0, end - start);
    } catch {
      return undefined;
    }
  }

  private async refundLatencyMs(returnId: string, refundAt?: string): Promise<number | undefined> {
    try {
      const rows = await query<{ t: string }>(
        `SELECT toString(max(event_time)) AS t FROM analytics.events_raw WHERE event_type = 'return.initiated' AND return_id = {rid:String} LIMIT 1`,
        { rid: returnId },
      );
      const initiatedAt = rows[0]?.t;
      if (!initiatedAt) return undefined;
      const start = new Date(initiatedAt).getTime();
      const end = this.toDateTime(refundAt).getTime();
      return Math.max(0, end - start);
    } catch {
      return undefined;
    }
  }

  private async write(rows: Record<string, any>[], eventAt?: string) {
    const end = chWriteLatencyMs.startTimer();
    try {
      const deduped = rows.filter((r) => this.markSeen(this.keyOf(r)));
      if (deduped.length) await insertEvents(deduped);
    } finally {
      end();
      const at = this.toDateTime(eventAt).getTime();
      etlLagSeconds.set(Math.max(0, (Date.now() - at) / 1000));
    }
    // On failure, spool (handled in caller)
  }

  private keyOf(r: Record<string, any>): string {
    return `${r.tenant_id}|${r.event_type}|${r.entity_id}|${new Date(r.event_time).toISOString()}`;
  }

  private markSeen(key: string): boolean {
    const now = Date.now();
    const prev = this.dedupe.get(key);
    this.dedupe.set(key, now);
    if (now - this.lastPrune > 30000) {
      for (const [k, t] of this.dedupe.entries())
        if (now - t > this.dedupeTtlMs) this.dedupe.delete(k);
      this.lastPrune = now;
    }
    return !prev || now - (prev || 0) > this.dedupeTtlMs;
  }

  private async drainSpool() {
    const batches = await readBatch(3);
    for (const b of batches) {
      try {
        await insertEvents(b.rows);
        await removeFile(b.file);
      } catch (e) {
        // leave file for next attempt
      }
    }
  }

  private async handleOrderCreated(msg: BaseEvent) {
    const row = {
      event_time: this.toDateTime(msg.at),
      tenant_id: msg.tenantId,
      entity_type: 'order',
      event_type: 'order.created',
      entity_id: msg.orderId || msg.id || '',
      order_id: msg.orderId || null,
      channel: msg.channel || null,
      payload: JSON.stringify(msg),
    };
    try {
      await this.write([row], msg.at);
    } catch (e) {
      etlErrorsTotal.inc({ stage: 'insert' });
      await writeSpool([row]);
    }
  }

  private async handleReturnInitiated(msg: BaseEvent) {
    const row = {
      event_time: this.toDateTime(msg.at),
      tenant_id: msg.tenantId,
      entity_type: 'return',
      event_type: 'return.initiated',
      entity_id: msg.returnId || msg.id || '',
      return_id: msg.returnId || null,
      order_id: msg.orderId || null,
      channel: msg.channel || null,
      reason: msg.reason || null,
      payload: JSON.stringify(msg),
    };
    try {
      await this.write([row], msg.at);
    } catch (e) {
      etlErrorsTotal.inc({ stage: 'insert' });
      await writeSpool([row]);
    }
  }

  private async handleReturnStateChanged(msg: BaseEvent) {
    const row = {
      event_time: this.toDateTime(msg.at),
      tenant_id: msg.tenantId,
      entity_type: 'return',
      event_type: 'return.state_changed',
      entity_id: msg.returnId || msg.id || '',
      return_id: msg.returnId || null,
      order_id: msg.orderId || null,
      channel: msg.channel || null,
      status: msg.state || null,
      payload: JSON.stringify(msg),
    };
    try {
      await this.write([row], msg.at);
    } catch (e) {
      etlErrorsTotal.inc({ stage: 'insert' });
      await writeSpool([row]);
    }
  }

  private async handleReturnLabelGenerated(msg: BaseEvent) {
    const latency = await this.approvalLatencyMs(msg.returnId, msg.at);
    const row = {
      event_time: this.toDateTime(msg.at),
      tenant_id: msg.tenantId,
      entity_type: 'return',
      event_type: 'return.label_generated',
      entity_id: msg.returnId || msg.id || '',
      return_id: msg.returnId || null,
      order_id: msg.orderId || null,
      label_id: msg.labelId || null,
      channel: msg.channel || null,
      carrier: msg.carrier || null,
      service: msg.service || null,
      amount_cents: msg.costCents ?? null,
      currency: msg.currency || null,
      latency_ms: latency ?? null,
      payload: JSON.stringify(msg),
    };
    try {
      await this.write([row], msg.at);
    } catch (e) {
      etlErrorsTotal.inc({ stage: 'insert' });
      await writeSpool([row]);
    }
  }

  private async handleRefundExecuted(msg: BaseEvent) {
    const latency = await this.refundLatencyMs(msg.returnId, msg.at);
    const row = {
      event_time: this.toDateTime(msg.at),
      tenant_id: msg.tenantId,
      entity_type: 'refund',
      event_type: 'refund.executed',
      entity_id: msg.refundId || msg.id || '',
      refund_id: msg.refundId || null,
      return_id: msg.returnId || null,
      status: msg.status || null,
      amount_cents: msg.amountCents ?? null,
      currency: msg.currency || null,
      latency_ms: latency ?? null,
      payload: JSON.stringify(msg),
    };
    try {
      await this.write([row], msg.at);
    } catch (e) {
      etlErrorsTotal.inc({ stage: 'insert' });
      await writeSpool([row]);
    }
  }

  private async handleWebhookDeliveryUpdated(msg: BaseEvent) {
    const row = {
      event_time: this.toDateTime(msg.at),
      tenant_id: msg.tenantId,
      entity_type: 'webhook',
      event_type: 'webhook.delivery_updated',
      entity_id: msg.deliveryId || msg.id || '',
      status: msg.status || null,
      payload: JSON.stringify(msg),
    };
    await this.write([row], msg.at);
  }
}
