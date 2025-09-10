import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class IngestOrderItemDto {
  @IsString()
  sku!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class IngestOrderDto {
  @IsString()
  channel!: string;

  @IsString()
  externalId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngestOrderItemDto)
  items!: IngestOrderItemDto[];
}

export class ListOrdersQueryDto {
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  channel?: string;
}
