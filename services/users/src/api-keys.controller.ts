import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Delete,
  Param,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import jwt from 'jsonwebtoken';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt: any = require('bcryptjs');

function requireUser(auth?: string) {
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

@Controller('/v1/api-keys')
export class ApiKeysController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Headers('authorization') auth?: string) {
    const { tenantId } = requireUser(auth);
    const keys = await (this.prisma as any).apiKey.findMany({
      where: { tenantId },
      select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
    });
    return { items: keys };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: { name: string }, @Headers('authorization') auth?: string) {
    const { userId, tenantId } = requireUser(auth);
    const rand = (len: number) => [...Array(len)].map(() => Math.random().toString(36)[2]).join('');
    const prefix = `dpk_${rand(8)}`;
    const secret = `sk_${rand(24)}`;
    const plaintext = `${prefix}.${secret}`;
    const keyHash = await bcrypt.hash(plaintext, 12);
    const created = await (this.prisma as any).apiKey.create({
      data: { tenantId, name: body.name || 'Key', keyPrefix: prefix, keyHash, createdBy: userId },
    });
    return {
      id: created.id,
      name: created.name,
      key: plaintext,
      keyPrefix: created.keyPrefix,
      createdAt: created.createdAt,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const { tenantId } = requireUser(auth);
    await (this.prisma as any).apiKey.deleteMany({ where: { id, tenantId } });
  }
}
