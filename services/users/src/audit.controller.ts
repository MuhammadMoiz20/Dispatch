import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import jwt from 'jsonwebtoken';

function getTenantFromAuth(auth?: string): { tenantId: string; userId?: string } | null {
  try {
    if (!auth) return null;
    const [scheme, token] = auth.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    if (!decoded?.tenantId) return null;
    return { tenantId: decoded.tenantId as string, userId: decoded.sub as string };
  } catch {
    return null;
  }
}

@Controller('/v1/audit')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async record(
    @Body()
    body: {
      tenantId?: string;
      userId?: string | null;
      apiKeyId?: string | null;
      action: string;
      resource: string;
      resourceId?: string | null;
      metadata?: any;
    },
    @Headers('authorization') auth?: string,
  ) {
    const from = getTenantFromAuth(auth);
    const tenantId = body.tenantId || from?.tenantId;
    if (!tenantId) return { ok: false };
    const rec = await (this.prisma as any).auditLog.create({ data: { ...body, tenantId } });
    return rec;
  }

  @Get()
  async list(@Query('tenantId') tenantId: string) {
    const items = await (this.prisma as any).auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items };
  }
}
