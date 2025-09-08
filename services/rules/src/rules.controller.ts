import 'reflect-metadata';
import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Min, validateOrReject } from 'class-validator';
import { RulesService } from './rules.service';
import { ruleEvalDuration } from './metrics.controller';

class CreateRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsObject()
  condition!: Record<string, any>;

  @IsArray()
  @Type(() => Object)
  actions!: any[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

class UpdateRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  actions?: any[];

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

@Controller('/v1')
export class RulesController {
  constructor(private rules: RulesService) {}

  @Get('/rules')
  async list(@Headers('authorization') auth?: string) {
    const tenantId = this.rules.getTenantIdFromAuth(auth);
    return await this.rules.listRules(tenantId);
  }

  @Post('/rules')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateRuleDto, @Headers('authorization') auth?: string) {
    const dto = plainToInstance(CreateRuleDto, body, { enableImplicitConversion: true });
    await validateOrReject(dto as any, { forbidUnknownValues: false });
    const tenantId = this.rules.getTenantIdFromAuth(auth);
    return await this.rules.createRule(tenantId, dto);
  }

  @Get('/rules/:id')
  async get(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const tenantId = this.rules.getTenantIdFromAuth(auth);
    return await this.rules.getRule(tenantId, id);
  }

  @Put('/rules/:id')
  async update(@Param('id') id: string, @Body() body: UpdateRuleDto, @Headers('authorization') auth?: string) {
    const dto = plainToInstance(UpdateRuleDto, body, { enableImplicitConversion: true });
    await validateOrReject(dto as any, { forbidUnknownValues: false });
    const tenantId = this.rules.getTenantIdFromAuth(auth);
    return await this.rules.updateRule(tenantId, id, dto);
  }

  @Delete('/rules/:id')
  async remove(@Param('id') id: string, @Headers('authorization') auth?: string) {
    const tenantId = this.rules.getTenantIdFromAuth(auth);
    return await this.rules.deleteRule(tenantId, id);
  }

  // internal: evaluate rules against a context
  @Post('/evaluate')
  async evaluate(@Body() body: any) {
    const end = ruleEvalDuration.startTimer();
    try {
      const tenantId = body?.tenantId;
      if (!tenantId) return { triggered: [] };
      return await this.rules.evaluateAndAct(tenantId, body?.context || {});
    } finally {
      end();
    }
  }
}

