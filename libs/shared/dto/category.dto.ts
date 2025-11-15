/**
 * DTO cho danh mục sản phẩm.
 *
 * Mô tả các trường cần thiết để tạo, cập nhật và truy vấn danh mục.
 */
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryCreateDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CategoryUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class CategoryIdDto {
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  id: string;
}

export class CategorySlugDto {
  @IsNotEmpty()
  @IsString()
  slug: string;
}

export class CategoryListQueryDto {
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

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  parentSlug?: string;
}
