import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsObject,
  IsOptional,
  IsIn,
} from 'class-validator';

export enum PaymentMethod {
  COD = 'COD',
  SePay = 'SePay',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class PaymentProcessDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: 'COD' | 'SePay';

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  amountInt: number; // Amount in cents
}

export class PaymentVerifyDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsObject()
  payload: Record<string, unknown>;
}

export class PaymentIdDto {
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class PaymentByOrderDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;
}

/**
 * SePay Webhook DTO
 * Validates incoming webhook payload from SePay
 * Docs: https://docs.sepay.vn/tich-hop-webhooks.html
 */
export class SePayWebhookDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  id: number;

  @IsNotEmpty()
  @IsString()
  gateway: string;

  @IsNotEmpty()
  @IsString()
  transactionDate: string;

  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsIn(['in', 'out'])
  transferType: 'in' | 'out';

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  transferAmount: number;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  accumulated: number;

  @IsOptional()
  @IsString()
  subAccount?: string | null;

  @IsNotEmpty()
  @IsString()
  referenceCode: string;

  @IsNotEmpty()
  @IsString()
  description: string;
}
