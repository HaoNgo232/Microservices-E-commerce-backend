/**
 * DTO cho sản phẩm.
 *
 * Mô tả các trường cần thiết để tạo, cập nhật và truy vấn sản phẩm.
 */
import { type ProductAttributes } from '@shared/types';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsNumber, IsPositive, IsArray, IsUrl, Min, IsObject } from 'class-validator';

export class ProductCreateDto {
  @IsNotEmpty()
  @IsString()
  sku: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  slug: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt: number; // Stored in cents (e.g., 1999 = $19.99)

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsUrl()
  model3dUrl?: string;
}

export class ProductUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt?: number; // Stored in cents

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsUrl()
  model3dUrl?: string;
}

export class ProductListQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minPriceInt?: number; // Price in cents

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  maxPriceInt?: number; // Price in cents
}

export class ProductIdDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class ProductIdsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids: string[];
}

export class ProductSlugDto {
  @IsNotEmpty()
  @IsString()
  slug: string;
}

export class StockChangeDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  quantity: number;
}

export class AdminCreateProductDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stock?: number;

  @IsOptional()
  attributes?: ProductAttributes;

  @IsOptional()
  @IsUrl()
  model3dUrl?: string;

  // File metadata for NATS transport
  @IsOptional()
  fileBuffer?: string; // Base64 encoded

  @IsOptional()
  @IsString()
  fileOriginalname?: string;

  @IsOptional()
  @IsString()
  fileMimetype?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  // Optional: try-on PNG file metadata for NATS transport
  @IsOptional()
  tryOnFileBuffer?: string; // Base64 encoded PNG

  @IsOptional()
  @IsString()
  tryOnFileOriginalname?: string;

  @IsOptional()
  @IsString()
  tryOnFileMimetype?: string;

  @IsOptional()
  @IsNumber()
  tryOnFileSize?: number;
}

export class AdminUpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsUrl()
  model3dUrl?: string;

  // File metadata for NATS transport
  @IsOptional()
  fileBuffer?: string;

  @IsOptional()
  @IsString()
  fileOriginalname?: string;

  @IsOptional()
  @IsString()
  fileMimetype?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  // Optional: try-on PNG file metadata for NATS transport
  @IsOptional()
  tryOnFileBuffer?: string;

  @IsOptional()
  @IsString()
  tryOnFileOriginalname?: string;

  @IsOptional()
  @IsString()
  tryOnFileMimetype?: string;

  @IsOptional()
  @IsNumber()
  tryOnFileSize?: number;
}
