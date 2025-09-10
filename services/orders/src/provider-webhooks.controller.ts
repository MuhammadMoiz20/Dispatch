import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('/v1/provider-webhooks')
export class ProviderWebhooksController {
  constructor(private prisma: PrismaService) {}

  // Stripe webhook stub: update refund status based on event
  @Post('/stripe')
  @HttpCode(HttpStatus.OK)
  async stripe(@Body() body: any, @Headers('Stripe-Signature') _sig?: string) {
    // TODO: verify signature using STRIPE_WEBHOOK_SECRET
    const type = body?.type as string | undefined;
    const refId = body?.data?.object?.id || body?.data?.object?.refund?.id;
    if (!type || !refId) return { ok: true };
    if (type === 'charge.refunded' || type === 'refund.succeeded') {
      try {
        await (this.prisma as any).refund.updateMany({
          where: { externalRefundId: refId },
          data: { status: 'succeeded' },
        });
      } catch {}
    }
    return { ok: true };
  }

  // Shopify Payments webhook stub
  @Post('/shopify')
  @HttpCode(HttpStatus.OK)
  async shopify(@Body() body: any, @Headers('X-Shopify-Hmac-SHA256') _sig?: string) {
    // TODO: verify signature using SHOPIFY_WEBHOOK_SECRET
    const status = (body?.refund?.status || '').toLowerCase();
    const refId = body?.refund?.id;
    if (!status || !refId) return { ok: true };
    if (status === 'succeeded' || status === 'success') {
      try {
        await (this.prisma as any).refund.updateMany({
          where: { externalRefundId: String(refId) },
          data: { status: 'succeeded' },
        });
      } catch {}
    }
    return { ok: true };
  }
}
