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
import { OrderStatus, PaymentStatus } from '@shared/types';

export class OrderItemDto {
  @IsNotEmpty()
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productName?: string; // Product name snapshot (optional in DTO, required in response)

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[]; // Product image URLs snapshot (optional in DTO, required in response)

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

export class OrderAdminListDto {
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
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  search?: string; // Search by order ID or user ID

  @IsOptional()
  @IsString()
  startDate?: string; // ISO date string

  @IsOptional()
  @IsString()
  endDate?: string; // ISO date string
}

export class OrderUpdateStatusRequestDto {
  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}

export class OrderUpdateStatusDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}

export class OrderUpdatePaymentStatusDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;
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
