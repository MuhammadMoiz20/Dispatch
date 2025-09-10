import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('/v1/preferences')
export class PreferencesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async get(
    @Query('tenantId') tenantId: string,
    @Query('userId') userId?: string,
    @Query('event') event?: string,
  ) {
    const where: any = { tenantId };
    if (userId) where.userId = userId;
    if (event) where.event = event;
    const items = await (this.prisma as any).notificationPreference.findMany({ where });
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async upsert(
    @Body()
    body: {
      tenantId: string;
      userId?: string | null;
      event: string;
      emailEnabled?: boolean;
      smsEnabled?: boolean;
      emailTemplateId?: string | null;
      smsTemplateId?: string | null;
    },
  ) {
    const data = await (this.prisma as any).notificationPreference.upsert({
      where: {
        tenantId_userId_event: {
          tenantId: body.tenantId,
          userId: body.userId ?? null,
          event: body.event,
        } as any,
      },
      create: body,
      update: {
        emailEnabled: body.emailEnabled ?? true,
        smsEnabled: body.smsEnabled ?? false,
        emailTemplateId: body.emailTemplateId ?? null,
        smsTemplateId: body.smsTemplateId ?? null,
      },
    });
    return data;
  }
}
