import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  CANCELLED = 'CANCELLED',
}

export class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt: number; // Price snapshot in cents
}

export class OrderCreateDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  addressId?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class OrderIdDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class OrderListDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

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
}

export class OrderUpdateStatusDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
}

export class OrderCancelDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class OrderItemAddDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  quantity: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  priceInt: number; // Price in cents
}

export class OrderItemRemoveDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class OrderItemListByOrderDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;
}
