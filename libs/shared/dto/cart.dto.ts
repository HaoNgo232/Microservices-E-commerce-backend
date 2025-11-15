/**
 * DTO cho giỏ hàng.
 *
 * Mô tả các trường cần thiết để tạo, cập nhật và truy vấn giỏ hàng.
 */
import { IsNotEmpty, IsString, IsNumber, IsPositive, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CartGetDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class CartAddItemDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsPositive()
  quantity: number;
}

export class CartUpdateItemDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quantity: number;
}

export class CartRemoveItemDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  productId: string;
}

export class CartClearDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class GuestItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsPositive()
  quantity: number;
}

export class CartMergeDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestItemDto)
  guestItems: GuestItemDto[];
}
