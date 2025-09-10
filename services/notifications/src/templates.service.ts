import Handlebars from 'handlebars';
import { PrismaService } from './prisma.service';

export type TemplateContext = Record<string, any>;

export class TemplatesService {
  constructor(private prisma: PrismaService) {}

  async render(tenantId: string, event: string, channel: 'email' | 'sms', ctx: TemplateContext) {
    const tpl = await (this.prisma as any).notificationTemplate.findFirst({
      where: { tenantId, event, channel },
    });
    if (!tpl) return { subject: '', body: '' };
    const hb = Handlebars.compile(tpl.body);
    const body = hb(ctx);
    const subject = tpl.subject ? Handlebars.compile(tpl.subject)(ctx) : '';
    return { subject, body };
  }
}
