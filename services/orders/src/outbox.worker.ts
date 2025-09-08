import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { createRabbitMQ } from '@dispatch/messaging';
import { eventsPublishedTotal } from './metrics.controller';

@Injectable()
export class OutboxWorker implements OnModuleInit {
  private logger = new Logger('OrdersOutboxWorker');
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const intervalMs = parseInt(process.env.OUTBOX_INTERVAL_MS || '2000', 10);
    setInterval(() => void this.drain().catch((e) => this.logger.warn(`outbox drain error: ${e?.message || e}`)), intervalMs);
  }

  private async drain(limit = 50) {
    const items = await (this.prisma as any).outbox.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: limit });
    for (const it of items) {
      try {
        await this.mq.publish(it.type, it.payload as any);
        await (this.prisma as any).outbox.update({ where: { id: it.id }, data: { status: 'published', attempts: (it.attempts || 0) + 1, publishedAt: new Date() } });
        eventsPublishedTotal.inc({ type: it.type });
      } catch (e) {
        await (this.prisma as any).outbox.update({ where: { id: it.id }, data: { attempts: (it.attempts || 0) + 1 } });
      }
    }
  }
}
