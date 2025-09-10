import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
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
  async ingest(
    @Body() body: IngestOrderDto,
    @Headers('authorization') auth: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Transform body into DTOs to satisfy @ValidateNested and @Type for items
    const toInstance: any = (plainToInstance as any) || ((_: any, v: any) => v);
    const dto = toInstance(IngestOrderDto, body, { enableImplicitConversion: true });
    // Avoid class-validator "unknownValue" error when validating plain objects inside arrays
    await validateOrReject(dto as any, { forbidUnknownValues: false });
    const tenantId = this.orders.getTenantIdFromAuth(auth);
    const result = await this.orders.ingest(tenantId, dto);
    if (result.created) ordersIngestedTotal.inc();
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListOrdersQueryDto, @Headers('authorization') auth?: string) {
    const toInstance: any = (plainToInstance as any) || ((_: any, v: any) => v);
    const dto = toInstance(ListOrdersQueryDto, query, { enableImplicitConversion: true });
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
