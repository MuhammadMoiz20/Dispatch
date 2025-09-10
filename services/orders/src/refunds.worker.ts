import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { createRabbitMQ } from '@dispatch/messaging';
import { getPaymentAdapter } from './payments.providers';
import { eventsPublishedTotal, refundLatencyMs, refundsTotal } from './metrics.controller';

@Injectable()
export class RefundsWorker implements OnModuleInit {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  private logger = new Logger(RefundsWorker.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.mq.subscribe<{
      refundId: string;
      tenantId: string;
      provider: string;
      chargeId: string;
    }>('refund.execute', async (msg) => {
      const start = Date.now();
      const refund = await (this.prisma as any).refund.findUnique({ where: { id: msg.refundId } });
      if (!refund) return;
      if (refund.status !== 'pending') return; // idempotent

      try {
        const adapter = getPaymentAdapter(refund.provider);
        const result = await adapter.refund({
          tenantId: refund.tenantId,
          chargeId: msg.chargeId,
          amountCents: refund.amountCents,
          currency: refund.currency,
          reason: refund.reason || undefined,
          idempotencyKey: refund.idempotencyKey || undefined,
        });

        if (result.status === 'succeeded') {
          await (this.prisma as any).refund.update({
            where: { id: refund.id },
            data: { status: 'succeeded', externalRefundId: result.externalRefundId, error: null },
          });
          // Update return state if not already refunded
          try {
            await (this.prisma as any).return.update({
              where: { id: refund.returnId },
              data: { state: 'refunded' },
            });
          } catch {}
          refundsTotal.inc({ status: 'succeeded' });
        } else {
          await (this.prisma as any).refund.update({
            where: { id: refund.id },
            data: {
              status: 'failed',
              externalRefundId: result.externalRefundId || null,
              error: result.error || 'unknown',
            },
          });
          refundsTotal.inc({ status: 'failed' });
        }

        // Outbox event
        try {
          await (this.prisma as any).outbox.create({
            data: {
              tenantId: refund.tenantId,
              type: 'refund.executed',
              payload: {
                refundId: refund.id,
                returnId: refund.returnId,
                status: result.status,
                externalRefundId: result.externalRefundId,
                provider: refund.provider,
                amountCents: refund.amountCents,
                currency: refund.currency,
                at: new Date().toISOString(),
              },
            },
          });
          eventsPublishedTotal.inc({ type: 'refund.executed' as any });
        } catch {}
      } catch (err: any) {
        this.logger.error(`Refund execution failed: ${err?.message || err}`);
        try {
          await (this.prisma as any).refund.update({
            where: { id: msg.refundId },
            data: { status: 'failed', error: err?.message || 'error' },
          });
          refundsTotal.inc({ status: 'failed' });
        } catch {}
      } finally {
        refundLatencyMs.observe(Date.now() - start);
      }
    });
  }
}
