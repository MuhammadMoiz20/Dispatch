import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEndpointDto, UpdateEndpointDto, ListDeliveriesQueryDto } from './webhooks.dto';
import { WebhooksService } from './webhooks.service';

@Controller('/v1')
export class WebhooksController {
  constructor(private svc: WebhooksService) {}

  @Get('/endpoints')
  async listEndpoints(@Headers('authorization') auth?: string) {
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return this.svc.listEndpoints(tenantId);
  }

  @Post('/endpoints')
  @HttpCode(HttpStatus.CREATED)
  async createEndpoint(@Body() body: CreateEndpointDto, @Headers('authorization') auth?: string) {
    const dto = plainToInstance(CreateEndpointDto, body, { enableImplicitConversion: true });
    await validateOrReject(dto as any);
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return this.svc.createEndpoint(tenantId, dto);
  }

  @Get('/endpoints/:id')
  async getEndpoint(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return await this.svc.getEndpoint(tenantId, id);
  }

  @Put('/endpoints/:id')
  async updateEndpoint(@Param('id') id: string, @Body() body: UpdateEndpointDto, @Headers('authorization') auth?: string) {
    const dto = plainToInstance(UpdateEndpointDto, body, { enableImplicitConversion: true });
    await validateOrReject(dto as any, { skipMissingProperties: true });
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return this.svc.updateEndpoint(tenantId, id, dto);
  }

  @Delete('/endpoints/:id')
  async deleteEndpoint(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return this.svc.deleteEndpoint(tenantId, id);
  }

  @Get('/deliveries')
  async listDeliveries(@Query() query: ListDeliveriesQueryDto, @Headers('authorization') auth?: string) {
    const dto = plainToInstance(ListDeliveriesQueryDto, query, { enableImplicitConversion: true });
    await validateOrReject(dto as any);
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return this.svc.listDeliveries(tenantId, dto);
  }

  @Post('/deliveries/:id/replay')
  @HttpCode(HttpStatus.OK)
  async replay(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const tenantId = this.svc.getTenantIdFromAuth(auth);
    return this.svc.replayDelivery(tenantId, id);
  }
}

