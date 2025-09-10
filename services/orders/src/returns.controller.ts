import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma.service';
import { validateOrReject, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { returnsInitiatedTotal } from './metrics.controller';
import jwt from 'jsonwebtoken';

class CreateReturnDto {
  @IsString()
  @Type(() => String)
  orderId!: string;

  @IsString()
  @Type(() => String)
  reason!: string;
}

@Controller('/v1/returns')
export class ReturnsController {
  constructor(private prisma: PrismaService) {}

  private parseAuth(auth?: string): { tenantId: string; userId: string; role?: string } {
    if (!auth) throw new UnauthorizedException('Missing Authorization');
    const [scheme, token] = auth.split(' ');
    if ((scheme || '').toLowerCase() !== 'bearer' || !token)
      throw new UnauthorizedException('Invalid Authorization');
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      const userId = decoded?.userId || decoded?.sub;
      const tenantId = decoded?.tenantId;
      const role = decoded?.role;
      if (!userId || !tenantId) throw new Error('Invalid token');
      return { userId, tenantId, role };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post()
  async create(
    @Body() body: CreateReturnDto,
    @Headers('authorization') auth: string | undefined,
    @Res() res: Response,
  ) {
    const dto = Object.assign(new CreateReturnDto(), body);
    await validateOrReject(dto);

    // Find order by id; do not require Authorization for MVP (portal flow). Tenant is derived from the order.
    const order = await (this.prisma as any).order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');

    // Idempotency: if an initiated return already exists for this order, return it with 200
    const existing = await (this.prisma as any).return.findFirst({
      where: { orderId: order.id, tenantId: order.tenantId, state: 'initiated' },
    });
    if (existing) {
      return res.status(HttpStatus.OK).json({ id: existing.id, state: existing.state });
    }

    // Initial state defined by returnsMachine config (kept in sync with workflows)
    const initialState = 'initiated';
    const ret = await (this.prisma as any).return.create({
      data: {
        orderId: order.id,
        tenantId: order.tenantId,
        reason: dto.reason,
        state: initialState,
      },
    });
    returnsInitiatedTotal.inc();
    // Emit initiated event for analytics
    try {
      await (this.prisma as any).outbox.create({
        data: {
          tenantId: order.tenantId,
          type: 'return.initiated',
          payload: {
            tenantId: order.tenantId,
            returnId: ret.id,
            orderId: order.id,
            channel: order.channel,
            reason: dto.reason,
            at: new Date().toISOString(),
          },
        },
      });
    } catch {}
    // Fire-and-forget rules evaluation for auto-actions (e.g., auto-approve)
    try {
      const _fetch: any = (globalThis as any).fetch;
      if (typeof _fetch === 'function') {
        const rulesBase = process.env.RULES_URL || 'http://127.0.0.1:4004';
        // Swallow network errors to keep this truly fire-and-forget in tests/dev
        void _fetch(`${rulesBase}/v1/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: order.tenantId,
            context: {
              return: { id: ret.id, orderId: order.id, reason: dto.reason, state: ret.state },
            },
          }),
        }).catch(() => {});
      }
    } catch {}
    return res.status(HttpStatus.CREATED).json({ id: ret.id, state: ret.state });
  }

  @Get('/:id')
  @HttpCode(HttpStatus.OK)
  async getById(@Param('id') id: string) {
    const r = await (this.prisma as any).return.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Return not found');
    return {
      id: r.id,
      orderId: r.orderId,
      state: r.state,
      reason: r.reason,
      createdAt: r.createdAt,
    };
  }

  // Generic transition endpoint
  @Post('/:id/transition')
  @HttpCode(HttpStatus.OK)
  async transition(
    @Param('id') id: string,
    @Body() body: { event: string },
    @Headers('authorization') auth?: string,
  ) {
    if (!body?.event) throw new BadRequestException('event is required');
    const current = await (this.prisma as any).return.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Return not found');

    // Compute next state using explicit transition map (aligned with returnsMachine)
    const transitions: Record<string, Record<string, string>> = {
      initiated: { APPROVE: 'label_generated', REJECT: 'closed' },
      label_generated: { SCAN: 'in_transit' },
      in_transit: { DELIVERED: 'delivered' },
      delivered: { INSPECT: 'inspected' },
      inspected: { REFUND: 'refunded' },
      refunded: {},
      closed: {},
    };
    const eventType = body.event.toUpperCase();
    const nextState = transitions[current.state]?.[eventType];
    if (!nextState) {
      // Maintain legacy behavior: return 400 for invalid even if auth missing
      throw new BadRequestException(`Invalid transition from ${current.state} via ${body.event}`);
    }
    // Enforce auth/role for restricted events only when transition is valid
    const restricted = new Set(['SCAN', 'DELIVERED', 'INSPECT', 'REFUND']);
    if (restricted.has(eventType)) {
      const actor = this.parseAuth(auth);
      if (actor.role !== 'warehouse' && actor.role !== 'owner')
        throw new UnauthorizedException('Insufficient role');
    }
    const updated = await (this.prisma as any).return.update({
      where: { id },
      data: { state: nextState },
    });
    // Load order channel for enriched event payload
    let orderChannel: string | undefined = undefined;
    try {
      const ord = await (this.prisma as any).order.findUnique({
        where: { id: current.orderId },
        select: { channel: true },
      });
      orderChannel = ord?.channel;
    } catch {}
    // Enqueue outbox event for state change (best-effort)
    try {
      await (this.prisma as any).outbox.create({
        data: {
          tenantId: current.tenantId,
          type: 'return.state_changed',
          payload: {
            returnId: updated.id,
            tenantId: current.tenantId,
            orderId: current.orderId,
            channel: orderChannel,
            state: updated.state,
            at: new Date().toISOString(),
          },
        },
      });
    } catch {}
    // Audit
    try {
      let userId: string | undefined;
      try {
        userId = this.parseAuth(auth as any)?.userId;
      } catch {}
      await (this.prisma as any).scanAudit.create?.({
        data: {
          tenantId: current.tenantId,
          returnId: updated.id,
          userId,
          deviceId: null,
          event: body.event.toUpperCase(),
        },
      });
    } catch {}
    return { id: updated.id, state: updated.state };
  }

  // Convenience endpoints for common events
  @Post('/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id') id: string) {
    return this.transition(id, { event: 'APPROVE' } as any);
  }

  @Post('/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id') id: string) {
    return this.transition(id, { event: 'REJECT' } as any);
  }

  @Post('/:id/scan')
  @HttpCode(HttpStatus.OK)
  async scan(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.transition(id, { event: 'SCAN' } as any, auth);
  }

  @Post('/:id/delivered')
  @HttpCode(HttpStatus.OK)
  async delivered(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.transition(id, { event: 'DELIVERED' } as any, auth);
  }

  @Post('/:id/inspect')
  @HttpCode(HttpStatus.OK)
  async inspect(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.transition(id, { event: 'INSPECT' } as any, auth);
  }

  @Post('/:id/refund')
  @HttpCode(HttpStatus.OK)
  async refund(@Param('id') id: string, @Headers('authorization') auth?: string) {
    return this.transition(id, { event: 'REFUND' } as any, auth);
  }
}
