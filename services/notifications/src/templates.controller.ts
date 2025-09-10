import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('/v1/templates')
export class TemplatesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @Query('tenantId') tenantId: string,
    @Query('event') event?: string,
    @Query('channel') channel?: string,
    @Headers('authorization') _auth?: string,
  ) {
    const where: any = { tenantId };
    if (event) where.event = event;
    if (channel) where.channel = channel;
    const items = await (this.prisma as any).notificationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body()
    body: {
      tenantId: string;
      name: string;
      event: string;
      channel: 'email' | 'sms';
      subject?: string;
      body: string;
    },
  ) {
    const data = await (this.prisma as any).notificationTemplate.create({ data: body });
    return data;
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; subject?: string; body: string }>,
  ) {
    const data = await (this.prisma as any).notificationTemplate.update({
      where: { id },
      data: body,
    });
    return data;
  }
}
