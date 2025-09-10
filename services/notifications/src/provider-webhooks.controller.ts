import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('/v1/provider-webhooks')
export class ProviderWebhooksController {
  constructor(private prisma: PrismaService) {}

  // Postmark webhook: delivery, bounce events
  @Post('/postmark')
  @HttpCode(HttpStatus.OK)
  async postmark(@Body() body: any, @Headers('X-Postmark-Signature') _sig?: string) {
    // For MVP, trust ingress; production should verify signature
    const event = body?.RecordType || body?._event || 'unknown';
    const email = body?.Email || body?.Recipient || 'unknown';
    await (this.prisma as any).notificationAttempt.create({
      data: {
        tenantId: body?.Metadata?.tenantId || 'unknown',
        event: body?.Metadata?.event || 'unknown',
        channel: 'email',
        provider: 'postmark',
        status: event,
        to: email,
        payload: body,
      },
    });
    return { ok: true };
  }

  // SendGrid webhook: array of events
  @Post('/sendgrid')
  @HttpCode(HttpStatus.OK)
  async sendgrid(@Body() body: any[]) {
    const arr = Array.isArray(body) ? body : [body];
    for (const evt of arr) {
      await (this.prisma as any).notificationAttempt.create({
        data: {
          tenantId: evt?.tenantId || 'unknown',
          event: evt?.event || 'unknown',
          channel: 'email',
          provider: 'sendgrid',
          status: evt?.event || evt?.status || 'unknown',
          to: evt?.email || evt?.recipient || 'unknown',
          payload: evt,
        },
      });
    }
    return { ok: true };
  }

  // Twilio webhook
  @Post('/twilio')
  @HttpCode(HttpStatus.OK)
  async twilio(@Body() body: any) {
    await (this.prisma as any).notificationAttempt.create({
      data: {
        tenantId: body?.tenantId || 'unknown',
        event: body?.event || 'unknown',
        channel: 'sms',
        provider: 'twilio',
        status: body?.MessageStatus || body?.SmsStatus || 'unknown',
        to: body?.To || 'unknown',
        payload: body,
      },
    });
    return { ok: true };
  }
}
