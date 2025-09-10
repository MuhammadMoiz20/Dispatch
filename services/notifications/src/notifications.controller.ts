import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TemplatesService } from './templates.service';
import { createEmailProvider, createSmsProvider } from './providers';

type SendEventDto = {
  event: string; // e.g., return.approved
  tenantId?: string; // optional if JWT provided
  channelTargets: { email?: string; phone?: string };
  context: Record<string, any>;
};

@Controller('/v1/notifications')
export class NotificationsController {
  private email = createEmailProvider();
  private sms = createSmsProvider();
  private templates: TemplatesService;

  constructor(private prisma: PrismaService) {
    this.templates = new TemplatesService(prisma);
  }

  @Post('/send')
  @HttpCode(HttpStatus.OK)
  async send(@Body() body: SendEventDto, @Headers('authorization') _auth?: string) {
    const tenantId = (body.tenantId || (global as any).tenant_id) as string | undefined; // fallback to middleware-populated res.locals (not accessible here)
    const tId = tenantId || body.tenantId || body.context?.tenantId;
    if (!tId) return { ok: false, error: 'tenant_required' };
    const prefs = await (this.prisma as any).notificationPreference.findFirst({
      where: { tenantId: tId, userId: null, event: body.event },
    });
    const emailEnabled = prefs?.emailEnabled ?? true;
    const smsEnabled = prefs?.smsEnabled ?? false;

    const results: any = {};
    if (emailEnabled && body.channelTargets?.email) {
      const tpl = await this.templates.render(tId, body.event, 'email', body.context);
      const res = await this.email.sendEmail({
        to: body.channelTargets.email,
        subject: tpl.subject,
        html: tpl.body,
        tenantId: tId,
        event: body.event,
      });
      await (this.prisma as any).notificationAttempt.create({
        data: {
          tenantId: tId,
          event: body.event,
          channel: 'email',
          provider: process.env.EMAIL_PROVIDER || 'noop',
          status: res.ok ? 'sent' : 'failed',
          to: body.channelTargets.email,
          payload: { subject: tpl.subject, body: tpl.body },
          response: res.response || null,
          error: res.error || null,
        },
      });
      results.email = res.ok;
    }
    if (smsEnabled && body.channelTargets?.phone) {
      const tpl = await this.templates.render(tId, body.event, 'sms', body.context);
      const res = await this.sms.sendSms({
        to: body.channelTargets.phone,
        body: tpl.body,
        tenantId: tId,
        event: body.event,
      });
      await (this.prisma as any).notificationAttempt.create({
        data: {
          tenantId: tId,
          event: body.event,
          channel: 'sms',
          provider: process.env.TWILIO_ACCOUNT_SID ? 'twilio' : 'noop',
          status: res.ok ? 'sent' : 'failed',
          to: body.channelTargets.phone,
          payload: { body: tpl.body },
          response: res.response || null,
          error: res.error || null,
        },
      });
      results.sms = res.ok;
    }
    return { ok: true, results };
  }
}
