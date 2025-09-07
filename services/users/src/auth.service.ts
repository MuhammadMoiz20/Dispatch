import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SignupDto, LoginDto } from './auth.dto';
import { Prisma } from '@prisma/client';
// Use require to avoid type dependency if @types not present in envs like Next workers
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt: any = require('bcryptjs');
import { signJwt } from './jwt';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async signup(input: SignupDto) {
  const prisma = this.prisma as any;
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Email already exists');

    return (this.prisma as any).$transaction(async (tx: any) => {
      const txx = tx as any;
      const tenant = await txx.tenant.create({ data: { name: input.tenantName } });
      const user = await txx.user.create({
        data: {
          email: input.email,
          role: 'owner',
          tenantId: tenant.id,
        },
      });
      const passwordHash = await bcrypt.hash(input.password, 10);
      await txx.authCredential.create({
        data: { userId: user.id, passwordHash },
      });
      const token = signJwt({ sub: user.id, tenantId: tenant.id, role: user.role });
      return { token, userId: user.id, tenantId: tenant.id };
    });
  }

  async login(input: LoginDto) {
  const prisma = this.prisma as any;
  const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
  const cred = await prisma.authCredential.findUnique({ where: { userId: user.id } });
    if (!cred) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(input.password, cred.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const token = signJwt({ sub: user.id, tenantId: user.tenantId, role: user.role });
    return { token, userId: user.id, tenantId: user.tenantId };
  }

  // Dev-only helper to reset or set a user's password
  async devSetPassword(email: string, newPassword: string) {
  const prisma = this.prisma as any;
  const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.authCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash },
      update: { passwordHash },
    });
    return { ok: true, userId: user.id, tenantId: user.tenantId };
  }
}
