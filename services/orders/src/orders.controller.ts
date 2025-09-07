import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IngestOrderDto, ListOrdersQueryDto } from './orders.dto';
import { OrdersService } from './orders.service';
import { listLatency, ordersIngestedTotal } from './metrics.controller';
import type { Response } from 'express';

@Controller('/v1/orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post('/ingest')
  async ingest(@Body() body: IngestOrderDto, @Headers('authorization') auth: string | undefined, @Res() res: Response) {
    const dto = plainToInstance(IngestOrderDto, body, { enableImplicitConversion: true });
    await validateOrReject(dto);
    const tenantId = this.orders.getTenantIdFromAuth(auth);
    const result = await this.orders.ingest(tenantId, dto);
    if (result.created) ordersIngestedTotal.inc();
    return res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK).json(result);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListOrdersQueryDto, @Headers('authorization') auth?: string) {
    const dto = plainToInstance(ListOrdersQueryDto, query, { enableImplicitConversion: true });
    await validateOrReject(dto);
    const tenantId = this.orders.getTenantIdFromAuth(auth);
    const end = listLatency.startTimer();
    try {
      return await this.orders.list(tenantId, dto);
    } finally {
      end();
    }
  }
}
