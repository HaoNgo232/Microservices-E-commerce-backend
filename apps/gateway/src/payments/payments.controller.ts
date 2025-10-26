import { Controller, Get, Post, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentProcessDto, PaymentVerifyDto } from '@shared/dto/payment.dto';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import {
  PaymentResponse,
  PaymentProcessResponse,
  PaymentVerifyResponse,
} from '@shared/types/payment.types';

/**
 * Payments Controller
 * Gateway endpoint cho payments - forward requests đến payment-service
 * Tất cả endpoints require authentication
 */
@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentsController extends BaseGatewayController {
  constructor(@Inject('PAYMENT_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * POST /payments/process
   * Xử lý thanh toán cho order
   * Trả về payment URL hoặc QR code tùy payment method
   */
  @Post('process')
  async process(@Body() dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    return await this.send<PaymentProcessDto, PaymentProcessResponse>(EVENTS.PAYMENT.PROCESS, dto);
  }

  /**
   * POST /payments/verify
   * Verify payment từ payment gateway callback
   */
  @Post('verify')
  async verify(@Body() dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
    return await this.send<PaymentVerifyDto, PaymentVerifyResponse>(EVENTS.PAYMENT.VERIFY, dto);
  }

  /**
   * GET /payments/:id
   * Lấy chi tiết payment theo ID
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<PaymentResponse> {
    return await this.send<string, PaymentResponse>(EVENTS.PAYMENT.GET_BY_ID, id);
  }

  /**
   * GET /payments/order/:orderId
   * Lấy payment theo order ID
   */
  @Get('order/:orderId')
  async findByOrder(@Param('orderId') orderId: string): Promise<PaymentResponse> {
    return await this.send<string, PaymentResponse>(EVENTS.PAYMENT.GET_BY_ORDER, orderId);
  }
}
