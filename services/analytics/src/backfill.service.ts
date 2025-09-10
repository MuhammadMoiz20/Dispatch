import { Injectable, Logger } from '@nestjs/common';
import { insertEvents } from './clickhouse';
import { query as pgq } from './pg';

type Range = { from: string; to: string; tenantId?: string };

@Injectable()
export class BackfillService {
  private logger = new Logger('AnalyticsBackfill');

  async backfill(range: Range) {
    const tasks = [
      this.backfillOrders(range),
      this.backfillReturns(range),
      this.backfillLabels(range),
      this.backfillRefunds(range),
      this.backfillWebhooks(range),
    ];
    await Promise.all(tasks);
  }

  private async backfillOrders({ from, to, tenantId }: Range) {
    const where: string[] = ['"createdAt" BETWEEN $1 AND $2'];
    const params: any[] = [from, to];
    if (tenantId) {
      where.push('"tenantId" = $3');
      params.push(tenantId);
    }
    const sql = `SELECT "id", "tenantId", "channel", "createdAt" FROM orders."Order" WHERE ${where.join(' AND ')}`;
    const { rows } = await pgq<{
      id: string;
      tenantId: string;
      channel: string;
      createdAt: string;
    }>(sql, params);
    const events = rows.map((r) => ({
      event_time: new Date(r.createdAt),
      tenant_id: r.tenantId,
      entity_type: 'order',
      event_type: 'order.created',
      entity_id: r.id,
      order_id: r.id,
      channel: r.channel,
      payload: JSON.stringify({
        orderId: r.id,
        tenantId: r.tenantId,
        channel: r.channel,
        at: r.createdAt,
      }),
    }));
    await insertEvents(events);
  }

  private async backfillReturns({ from, to, tenantId }: Range) {
    const where: string[] = ['r."createdAt" BETWEEN $1 AND $2'];
    const params: any[] = [from, to];
    if (tenantId) {
      where.push('r."tenantId" = $3');
      params.push(tenantId);
    }
    const sql = `
      SELECT r."id" as returnId, r."tenantId", r."orderId", r."reason", r."createdAt", o."channel"
      FROM orders."Return" r
      JOIN orders."Order" o ON o."id" = r."orderId"
      WHERE ${where.join(' AND ')}
    `;
    const { rows } = await pgq<{
      returnId: string;
      tenantId: string;
      orderId: string;
      reason: string;
      createdAt: string;
      channel: string;
    }>(sql, params);
    const events = rows.map((r) => ({
      event_time: new Date(r.createdAt),
      tenant_id: r.tenantId,
      entity_type: 'return',
      event_type: 'return.initiated',
      entity_id: r.returnId,
      return_id: r.returnId,
      order_id: r.orderId,
      channel: r.channel,
      reason: r.reason,
      payload: JSON.stringify({
        returnId: r.returnId,
        orderId: r.orderId,
        tenantId: r.tenantId,
        channel: r.channel,
        reason: r.reason,
        at: r.createdAt,
      }),
    }));
    await insertEvents(events);
  }

  private async backfillLabels({ from, to, tenantId }: Range) {
    const where: string[] = ['l."createdAt" BETWEEN $1 AND $2'];
    const params: any[] = [from, to];
    if (tenantId) {
      where.push('l."tenantId" = $3');
      params.push(tenantId);
    }
    const sql = `
      SELECT l."id" as labelId, l."tenantId", l."returnId", l."carrier", l."service", l."costCents", l."currency", l."createdAt", r."orderId", o."channel"
      FROM orders."Label" l
      JOIN orders."Return" r ON r."id" = l."returnId"
      JOIN orders."Order" o ON o."id" = r."orderId"
      WHERE ${where.join(' AND ')}
    `;
    const { rows } = await pgq<{
      labelId: string;
      tenantId: string;
      returnId: string;
      carrier: string;
      service: string;
      costCents: number;
      currency: string;
      createdAt: string;
      orderId: string;
      channel: string;
    }>(sql, params);
    const events = rows.map((r) => ({
      event_time: new Date(r.createdAt),
      tenant_id: r.tenantId,
      entity_type: 'return',
      event_type: 'return.label_generated',
      entity_id: r.returnId,
      return_id: r.returnId,
      order_id: r.orderId,
      label_id: r.labelId,
      channel: r.channel,
      carrier: r.carrier,
      service: r.service,
      amount_cents: r.costCents,
      currency: r.currency,
      payload: JSON.stringify({
        tenantId: r.tenantId,
        returnId: r.returnId,
        labelId: r.labelId,
        orderId: r.orderId,
        channel: r.channel,
        carrier: r.carrier,
        service: r.service,
        costCents: r.costCents,
        currency: r.currency,
        at: r.createdAt,
      }),
    }));
    await insertEvents(events);
  }

  private async backfillRefunds({ from, to, tenantId }: Range) {
    const where: string[] = ['"updatedAt" BETWEEN $1 AND $2'];
    const params: any[] = [from, to];
    if (tenantId) {
      where.push('"tenantId" = $3');
      params.push(tenantId);
    }
    const sql = `SELECT "id" as refundId, "tenantId", "returnId", "provider", "amountCents", "currency", "status", "updatedAt" FROM orders."Refund" WHERE ${where.join(' AND ')}`;
    const { rows } = await pgq<{
      refundId: string;
      tenantId: string;
      returnId: string;
      provider: string;
      amountCents: number;
      currency: string;
      status: string;
      updatedAt: string;
    }>(sql, params);
    const events = rows.map((r) => ({
      event_time: new Date(r.updatedAt),
      tenant_id: r.tenantId,
      entity_type: 'refund',
      event_type: 'refund.executed',
      entity_id: r.refundId,
      refund_id: r.refundId,
      return_id: r.returnId,
      status: r.status,
      amount_cents: r.amountCents,
      currency: r.currency,
      payload: JSON.stringify({
        refundId: r.refundId,
        returnId: r.returnId,
        provider: r.provider,
        amountCents: r.amountCents,
        currency: r.currency,
        status: r.status,
        at: r.updatedAt,
      }),
    }));
    await insertEvents(events);
  }

  private async backfillWebhooks({ from, to, tenantId }: Range) {
    const where: string[] = ['"updatedAt" BETWEEN $1 AND $2'];
    const params: any[] = [from, to];
    if (tenantId) {
      where.push('"tenantId" = $3');
      params.push(tenantId);
    }
    const sql = `SELECT "id" as deliveryId, "tenantId", "status", "updatedAt" FROM webhooks."Delivery" WHERE ${where.join(' AND ')}`;
    const { rows } = await pgq<{
      deliveryId: string;
      tenantId: string;
      status: string;
      updatedAt: string;
    }>(sql, params);
    const events = rows.map((r) => ({
      event_time: new Date(r.updatedAt),
      tenant_id: r.tenantId,
      entity_type: 'webhook',
      event_type: 'webhook.delivery_updated',
      entity_id: r.deliveryId,
      status: r.status,
      payload: JSON.stringify({
        deliveryId: r.deliveryId,
        tenantId: r.tenantId,
        status: r.status,
        at: r.updatedAt,
      }),
    }));
    await insertEvents(events);
  }
}
