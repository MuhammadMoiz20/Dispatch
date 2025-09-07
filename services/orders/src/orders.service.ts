import { ConflictException, Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';
import { createRabbitMQ } from '@dispatch/messaging/src/rabbitmq';
import { IngestOrderDto, ListOrdersQueryDto } from './orders.dto';
import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export type OrderSummary = {
  id: string;
  channel: string;
  externalId: string;
  status: string;
  createdAt: Date;
  itemsCount: number;
};

@Injectable()
export class OrdersService {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  constructor(private prisma: PrismaService) {}

  getTenantIdFromAuth(authHeader?: string): string {
    if (!authHeader) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = authHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Invalid Authorization');
    try {
      const decoded = jwt.verify(token, DEFAULT_SECRET) as any;
      const tenantId = decoded?.tenantId;
      if (!tenantId) throw new UnauthorizedException('Invalid token');
      return tenantId;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async ingest(tenantId: string, input: IngestOrderDto) {
    try {
      const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const order = await tx.order.create({
          data: {
            tenantId,
            channel: input.channel,
            externalId: input.externalId,
            items: {
              createMany: {
                data: input.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
              },
            },
          },
          include: { items: true },
        });
        return order;
      });
      // publish event (best-effort; do not fail ingestion if MQ is unavailable)
      try {
        await this.mq.publish('order.created', {
          orderId: created.id,
          tenantId,
          channel: input.channel,
          externalId: input.externalId,
          items: input.items,
          at: new Date().toISOString(),
        });
      } catch {
        // no-op in dev/seed scenarios
      }
      return { created: true, orderId: created.id };
    } catch (e: any) {
      // Prisma P2002 is unique constraint violation
      if (e?.code === 'P2002') {
        const existing = await this.prisma.order.findUnique({
          where: { tenantId_channel_externalId: { tenantId, channel: input.channel, externalId: input.externalId } },
        });
        if (!existing) throw new ConflictException('Duplicate order');
        return { created: false, orderId: existing.id };
      }
      throw new InternalServerErrorException(e?.message || 'Failed to ingest order');
    }
  }

  async list(tenantId: string, query: ListOrdersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }) as any,
    ]);

    const items: OrderSummary[] = rows.map((o: any) => ({
      id: o.id,
      channel: o.channel,
      externalId: o.externalId,
      status: o.status,
      createdAt: o.createdAt,
      itemsCount: o._count?.items ?? 0,
    }));

    return { items, page, pageSize, total };
  }
}
