/**
 * DTO cho thực tế tăng cường (AR).
 *
 * Mô tả các trường cần thiết để tạo và truy vấn ảnh chụp AR.
 */
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsUrl, IsPositive, Min, IsObject } from 'class-validator';

export class ARSnapshotCreateDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ARSnapshotListDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsPositive()
  pageSize?: number;
}
