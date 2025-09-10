import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { createRabbitMQ } from '@dispatch/messaging';
import { refundsTotal } from './metrics.controller';

type RefundResponse = {
  id: string;
  returnId: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  externalRefundId?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Controller('/v1')
export class RefundsController {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  constructor(private prisma: PrismaService) {}

  @Post('/returns/:id/refund')
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    @Param('id') id: string,
    @Body()
    body: {
      amountCents?: number;
      currency?: string;
      reason?: string;
      provider?: string;
      chargeId?: string;
    },
    @Headers('Idempotency-Key') idemp?: string,
  ) {
    const ret = await (this.prisma as any).return.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return not found');

    // Idempotent on existing refund for the return
    const existing = await (this.prisma as any).refund.findFirst?.({
      where: { returnId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return this.toResponse(existing);

    // Determine payment and defaults
    const payment = await (this.prisma as any).payment.findFirst?.({
      where: { orderId: ret.orderId, tenantId: ret.tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const provider = (body.provider || payment?.provider || 'stripe').toLowerCase();
    const amountCents = body.amountCents ?? payment?.amountCents ?? 0;
    const currency = (body.currency || payment?.currency || 'USD').toUpperCase();
    const chargeId = body.chargeId || payment?.chargeId || 'unknown_charge';

    const created = await (this.prisma as any).refund.create({
      data: {
        tenantId: ret.tenantId,
        returnId: id,
        paymentId: payment?.id,
        provider,
        amountCents,
        currency,
        status: 'pending',
        reason: body.reason || null,
        idempotencyKey: idemp || null,
      },
    });

    // Enqueue async job to execute refund
    await this.mq.publish('refund.execute', {
      refundId: created.id,
      tenantId: ret.tenantId,
      provider,
      chargeId,
    });
    refundsTotal.inc({ status: 'pending' });
    return this.toResponse(created);
  }

  @Get('/returns/:id/refund')
  @HttpCode(HttpStatus.OK)
  async byReturn(@Param('id') id: string) {
    const r = await (this.prisma as any).refund.findFirst?.({
      where: { returnId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!r) throw new NotFoundException('Refund not found');
    return this.toResponse(r);
  }

  private toResponse(r: any): RefundResponse {
    return {
      id: r.id,
      returnId: r.returnId,
      provider: r.provider,
      amountCents: r.amountCents,
      currency: r.currency,
      status: r.status,
      externalRefundId: r.externalRefundId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
