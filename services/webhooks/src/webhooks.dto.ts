import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEndpointDto {
  @IsUrl()
  @Type(() => String)
  url!: string;

  @IsString()
  @Type(() => String)
  secret!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateEndpointDto {
  @IsOptional()
  @IsUrl()
  @Type(() => String)
  url?: string;

  @IsOptional()
  @IsString()
  @Type(() => String)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ListDeliveriesQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  endpointId?: string;
}
