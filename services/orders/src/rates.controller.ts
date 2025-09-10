import { Controller, Get, HttpCode, HttpStatus, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { getCarrierAdapter } from './carriers';

@Controller('/v1/returns')
export class RatesController {
  constructor(private prisma: PrismaService) {}

  @Get('/:id/rates')
  @HttpCode(HttpStatus.OK)
  async list(@Param('id') id: string) {
    const ret = await (this.prisma as any).return.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return not found');

    // Fetch preferred provider from credentials if present; else use mock
    // Simplified: pick the first credential for tenant
    const cred = await (this.prisma as any).carrierCredential.findFirst?.({
      where: { tenantId: ret.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    const provider = cred?.provider || 'mock';
    const apiKey = cred?.apiKey;

    const adapter = getCarrierAdapter(provider, apiKey);
    const quotes = await adapter.getRates({
      id: ret.id,
      tenantId: ret.tenantId,
      orderId: ret.orderId,
    });
    return { items: quotes };
  }
}
