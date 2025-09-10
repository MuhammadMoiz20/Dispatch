import { Body, Controller, Get, Headers, Param, Put, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import jwt from 'jsonwebtoken';

function authTenant(auth?: string) {
  if (!auth) throw new UnauthorizedException('Missing Authorization');
  const [scheme, token] = auth.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token)
    throw new UnauthorizedException('Invalid Authorization');
  const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
  if (!decoded?.sub || !decoded?.tenantId) throw new UnauthorizedException('Invalid token');
  return {
    userId: decoded.sub as string,
    tenantId: decoded.tenantId as string,
    role: decoded.role as string,
  };
}

@Controller('/v1/users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Headers('authorization') auth?: string) {
    const { tenantId } = authTenant(auth);
    const items = await (this.prisma as any).user.findMany({
      where: { tenantId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    return { items };
  }

  @Put(':id/role')
  async setRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Headers('authorization') auth?: string,
  ) {
    const { tenantId, role } = authTenant(auth);
    if (!['owner', 'admin'].includes((role || '').toLowerCase()))
      throw new UnauthorizedException('Insufficient role');
    const updated = await (this.prisma as any).user.updateMany({
      where: { id, tenantId },
      data: { role: body.role },
    });
    return { ok: true, updated: updated.count };
  }
}
