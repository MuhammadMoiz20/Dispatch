import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('/v1/devices')
export class DevicesController {
  constructor(private prisma: PrismaService) {}

  private parseAuth(auth?: string): { userId: string; tenantId: string } {
    if (!auth) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = auth.split(' ');
    if ((scheme || '').toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Invalid Authorization');
    const jwt = require('jsonwebtoken');
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      const userId = decoded?.userId || decoded?.sub;
      const tenantId = decoded?.tenantId;
      if (!userId || !tenantId) throw new Error('Invalid token');
      return { userId, tenantId };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post('/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: { deviceName?: string }, @Headers('authorization') auth?: string) {
    const actor = this.parseAuth(auth);
    const token = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const d = await (this.prisma as any).device.create({
      data: { userId: actor.userId, deviceName: body?.deviceName || 'warehouse-device', token },
    });
    return { id: d.id, token: d.token, deviceName: d.deviceName };
  }
}

