import 'reflect-metadata';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import jwt from 'jsonwebtoken';
import { createRabbitMQ } from '@dispatch/messaging';
import { deliverWebhook } from '@dispatch/webhooks-core';
import {
  webhookRetryTotal,
  successTotal,
  failureTotal,
  updateSuccessRateGauge,
  dlqDepthGauge,
} from './metrics.controller';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const MAX_ATTEMPTS = 5;

export type DeliverySummary = {
  id: string;
  endpointId: string;
  eventType: string;
  status: string;
  attempts: number;
  responseStatus?: number | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
  nextAttemptAt?: Date | null;
};

@Injectable()
export class WebhooksService {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  constructor(private prisma: PrismaService) {}

  getTenantIdFromAuth(authHeader?: string): string {
    if (!authHeader) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token)
      throw new UnauthorizedException('Invalid Authorization');
    try {
      const decoded = jwt.verify(token, DEFAULT_SECRET) as any;
      const tenantId = decoded?.tenantId;
      if (!tenantId) throw new UnauthorizedException('Invalid token');
      return tenantId;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async createEndpoint(
    tenantId: string,
    input: { url: string; secret: string; enabled?: boolean },
  ) {
    const ep = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.endpoint.create({
        data: { tenantId, url: input.url, secret: input.secret, enabled: input.enabled ?? true },
      }),
    );
    return { id: ep.id, url: ep.url, enabled: ep.enabled, createdAt: ep.createdAt };
  }

  async listEndpoints(tenantId: string) {
    const rows = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.endpoint.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
    );
    return rows.map((e: { id: string; url: string; enabled: boolean; createdAt: Date }) => ({
      id: e.id,
      url: e.url,
      enabled: e.enabled,
      createdAt: e.createdAt,
    }));
  }

  async getEndpoint(tenantId: string, id: string) {
    const e = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.endpoint.findFirst({ where: { id, tenantId } }),
    );
    if (!e) return null;
    return { id: e.id, url: e.url, enabled: e.enabled, createdAt: e.createdAt };
  }

  async updateEndpoint(
    tenantId: string,
    id: string,
    input: Partial<{ url: string; secret: string; enabled: boolean }>,
  ) {
    const existing = await (this.prisma as any).endpoint.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) throw new UnauthorizedException('Not found');
    const e = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.endpoint.update({ where: { id }, data: input }),
    );
    return { id: e.id, url: e.url, enabled: e.enabled, createdAt: e.createdAt };
  }

  async deleteEndpoint(tenantId: string, id: string) {
    const e = await (this.prisma as any).endpoint.findUnique({ where: { id } });
    if (!e || e.tenantId !== tenantId) return { ok: false };
    await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.endpoint.delete({ where: { id } }),
    );
    return { ok: true };
  }

  async listDeliveries(
    tenantId: string,
    query: { page?: number; pageSize?: number; status?: string; endpointId?: string },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.endpointId) where.endpointId = query.endpointId;
    const [total, rows] = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      (this.prisma as any).$transaction([
        tx.delivery.count({ where }),
        tx.delivery.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]),
    );
    const items: DeliverySummary[] = rows.map((d: any) => ({
      id: d.id,
      endpointId: d.endpointId,
      eventType: d.eventType,
      status: d.status,
      attempts: d.attempts,
      responseStatus: d.responseStatus ?? null,
      lastError: d.lastError ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      nextAttemptAt: d.nextAttemptAt ?? null,
    }));
    return { items, page, pageSize, total };
  }

  computeBackoffMs(attempt: number): number {
    const base = 5000; // 5s
    const max = 60000; // 60s cap
    const ms = base * Math.pow(2, Math.max(0, attempt - 1));
    return Math.min(ms, max);
  }

  async scheduleDelivery(deliveryId: string, delayMs = 0) {
    if (delayMs <= 0) {
      await this.mq.publish('webhooks.deliver', { deliveryId });
    } else {
      setTimeout(() => {
        void this.mq.publish('webhooks.deliver', { deliveryId });
      }, delayMs);
    }
  }

  shouldRetry(status: number | undefined, err?: any): boolean {
    if (err) return true; // network/timeout
    if (!status) return true;
    if (status >= 200 && status < 300) return false;
    if (status >= 500) return true;
    if (status === 429) return true;
    return false; // other 4xx are not retried
  }

  async processDelivery(deliveryId: string) {
    const d = await (this.prisma as any).delivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!d) return;
    if (!d.endpoint?.enabled) {
      await (this.prisma as any).delivery.update({
        where: { id: d.id },
        data: { status: 'dead', lastError: 'Endpoint disabled' },
      });
      return;
    }
    try {
      const payloadObj = (d as any).payload ?? {};
      const res = await deliverWebhook({
        url: d.endpoint.url,
        secret: d.endpoint.secret,
        payload: payloadObj as object,
      });
      const status = res?.status as number | undefined;
      if (status && status >= 200 && status < 300) {
        const updated = await (this.prisma as any).delivery.update({
          where: { id: d.id },
          data: {
            status: 'delivered',
            attempts: d.attempts + 1,
            responseStatus: status,
            lastError: null,
          },
        });
        await this.emitDeliveryUpdated(updated);
        successTotal.inc();
        updateSuccessRateGauge();
        return;
      }
      const should = this.shouldRetry(status);
      if (should) {
        const attempt = d.attempts + 1;
        const delay = this.computeBackoffMs(attempt);
        const next = new Date(Date.now() + delay);
        webhookRetryTotal.inc();
        const updated = await (this.prisma as any).delivery.update({
          where: { id: d.id },
          data: {
            status: attempt >= MAX_ATTEMPTS ? 'dead' : 'retrying',
            attempts: attempt,
            responseStatus: status,
            nextAttemptAt: next,
          },
        });
        await this.emitDeliveryUpdated(updated);
        if (updated.status !== 'dead') await this.scheduleDelivery(d.id, delay);
        else await this.updateDlqDepthGauge();
      } else {
        const updated = await (this.prisma as any).delivery.update({
          where: { id: d.id },
          data: { status: 'failed', attempts: d.attempts + 1, responseStatus: status },
        });
        await this.emitDeliveryUpdated(updated);
        failureTotal.inc();
        updateSuccessRateGauge();
      }
    } catch (err: any) {
      const attempt = d.attempts + 1;
      const delay = this.computeBackoffMs(attempt);
      const next = new Date(Date.now() + delay);
      webhookRetryTotal.inc();
      const updated = await (this.prisma as any).delivery.update({
        where: { id: d.id },
        data: {
          status: attempt >= MAX_ATTEMPTS ? 'dead' : 'retrying',
          attempts: attempt,
          lastError: err?.message || 'network',
          nextAttemptAt: next,
        },
      });
      await this.emitDeliveryUpdated(updated);
      if (updated.status !== 'dead') await this.scheduleDelivery(d.id, delay);
      else await this.updateDlqDepthGauge();
    }
  }

  async createDeliveriesForEvent(event: { tenantId: string; type: string; payload: any }) {
    const endpoints = await (this.prisma as any).runWithTenant(event.tenantId, async (tx: any) =>
      tx.endpoint.findMany({ where: { tenantId: event.tenantId, enabled: true } }),
    );
    for (const ep of endpoints) {
      const d = await (this.prisma as any).runWithTenant(event.tenantId, async (tx: any) =>
        tx.delivery.create({
          data: {
            tenantId: event.tenantId,
            endpointId: ep.id,
            eventType: event.type,
            payload: event.payload,
            status: 'pending',
            attempts: 0,
          },
        }),
      );
      await this.scheduleDelivery(d.id);
    }
  }

  async enqueueDueDeliveries(limit = 50) {
    const now = new Date();
    const due = await (this.prisma as any).delivery.findMany({
      where: {
        OR: [{ status: 'pending' }, { status: 'retrying', nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    for (const d of due) await this.scheduleDelivery(d.id);
  }

  async updateDlqDepthGauge() {
    const count = await (this.prisma as any).delivery.count({ where: { status: 'dead' } });
    dlqDepthGauge.set(count);
  }

  async replayDelivery(tenantId: string, id: string) {
    const d = await (this.prisma as any).delivery.findUnique({
      where: { id },
      include: { endpoint: true },
    });
    if (!d || d.tenantId !== tenantId) throw new UnauthorizedException('Not found');
    const updated = await (this.prisma as any).runWithTenant(tenantId, async (tx: any) =>
      tx.delivery.update({
        where: { id },
        data: { status: 'pending', attempts: 0, nextAttemptAt: new Date() },
      }),
    );
    await this.scheduleDelivery(updated.id);
    return { ok: true };
  }

  private async emitDeliveryUpdated(d: any) {
    try {
      await (this.prisma as any).outbox.create({
        data: {
          tenantId: d.tenantId,
          type: 'webhook.delivery_updated',
          payload: {
            tenantId: d.tenantId,
            deliveryId: d.id,
            status: d.status,
            attempts: d.attempts,
            responseStatus: d.responseStatus ?? null,
            at: new Date().toISOString(),
          },
        },
      });
    } catch {}
  }
}
