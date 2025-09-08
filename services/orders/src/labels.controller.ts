import { Body, Controller, Get, Headers, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as storage from './storage';
import { labelsGeneratedTotal, labelGenerationDurationMs } from './metrics.controller';
import { createRabbitMQ } from '@dispatch/messaging';

type LabelRecord = {
  id: string;
  returnId: string;
  carrier: string;
  service: string;
  costCents: number;
  currency: string;
  objectKey: string;
  createdAt: Date;
};

type LabelResponse = {
  id: string;
  returnId: string;
  carrier: string;
  service: string;
  costCents: number;
  currency: string;
  downloadUrl: string;
  createdAt: Date;
};

@Controller('/v1/returns')
export class LabelsController {
  private mq = createRabbitMQ(process.env.RABBITMQ_URL);
  constructor(private prisma: PrismaService) {}

  @Post('/:id/label')
  @HttpCode(HttpStatus.CREATED)
  async generate(@Param('id') id: string, @Body() body?: { carrier?: string; service?: string }, @Headers('authorization') _auth?: string) {
    const start = Date.now();
    const ret = await (this.prisma as any).return.findUnique({ where: { id } });
    if (!ret) throw new NotFoundException('Return not found');
    const tenantId = ret.tenantId;
    // Idempotent: return existing
    const existing = await (this.prisma as any).label.findUnique?.({ where: { returnId: id } });
    if (existing) {
      const url = await storage.getLabelDownloadUrl(existing.objectKey);
      return this.toResponse(existing, url);
    }

    const carrier = body?.carrier || 'mock-carrier';
    const service = body?.service || 'ground';
    const key = `labels/${tenantId}/${id}-${Date.now()}.txt`;
    const content = this.renderMockLabel({ returnId: id, carrier, service });
    await storage.putLabelObject(key, content, 'text/plain');

    // Persist label
    const created: LabelRecord = await (this.prisma as any).label.create({
      data: {
        tenantId,
        returnId: id,
        carrier,
        service,
        costCents: 900,
        currency: 'USD',
        objectKey: key,
      },
    });

    // Update return state to label_generated if still initiated
    try {
      if (ret.state === 'initiated') {
        await (this.prisma as any).return.update({ where: { id }, data: { state: 'label_generated' } });
      }
    } catch {}

    // Enqueue outbox event
    try {
      await (this.prisma as any).outbox.create({
        data: {
          tenantId,
          type: 'return.label_generated',
          payload: {
            tenantId,
            returnId: id,
            labelId: created.id,
            carrier,
            service,
            costCents: created.costCents,
            currency: created.currency,
            at: new Date().toISOString(),
          },
        },
      });
    } catch {}

    const url = await storage.getLabelDownloadUrl(key);
    labelsGeneratedTotal.inc({ carrier });
    labelGenerationDurationMs.observe(Date.now() - start);
    return this.toResponse(created, url);
  }

  @Get('/:id/label')
  @HttpCode(HttpStatus.OK)
  async get(@Param('id') id: string) {
    const lbl = await (this.prisma as any).label.findUnique?.({ where: { returnId: id } });
    if (!lbl) throw new NotFoundException('Label not found');
    const url = await storage.getLabelDownloadUrl(lbl.objectKey);
    return this.toResponse(lbl as LabelRecord, url);
  }

  private toResponse(l: LabelRecord, url: string): LabelResponse {
    return {
      id: l.id,
      returnId: l.returnId,
      carrier: l.carrier,
      service: l.service,
      costCents: l.costCents,
      currency: l.currency,
      downloadUrl: url || '',
      createdAt: l.createdAt,
    };
  }

  private renderMockLabel(input: { returnId: string; carrier: string; service: string }): string {
    return `Dispatch Return Label\nReturn: ${input.returnId}\nCarrier: ${input.carrier}\nService: ${input.service}\nIssued: ${new Date().toISOString()}\n`;
  }
}
