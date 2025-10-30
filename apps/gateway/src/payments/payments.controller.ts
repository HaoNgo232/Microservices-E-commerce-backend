import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PaymentProcessDto, PaymentVerifyDto, SePayWebhookDto } from '@shared/dto/payment.dto';
import { EVENTS } from '@shared/events';
import { BaseGatewayController } from '../base.controller';
import {
  PaymentResponse,
  PaymentProcessResponse,
  PaymentVerifyResponse,
} from '@shared/types/payment.types';
import { SePayWebhookResponse } from '@shared/types/payment.webhook.types';

/**
 * Payments Controller
 * Gateway endpoint cho payments - forward requests đến payment-service
 * Tất cả endpoints require authentication
 */
@Controller('payments')
export class PaymentsController extends BaseGatewayController {
  constructor(@Inject('PAYMENT_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  /**
   * POST /payments/webhook/sepay
   * Endpoint nhận webhook từ Sepay
   */
  @Post('webhook/sepay')
  sepayWebhook(@Body() dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
    console.log('Received SEPAY webhook:', dto);
    return this.send<SePayWebhookDto, SePayWebhookResponse>(EVENTS.PAYMENT.WEBHOOK_SEPAY, dto);
  }

  /**
   * POST /payments/process
   * Xử lý thanh toán cho order
   * Trả về payment URL hoặc QR code tùy payment method
   */
  @Post('process')
  process(@Body() dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    return this.send<PaymentProcessDto, PaymentProcessResponse>(EVENTS.PAYMENT.PROCESS, dto);
  }

  /**
   * POST /payments/verify
   * Verify payment từ payment gateway callback
   */
  @Post('verify')
  verify(@Body() dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
    return this.send<PaymentVerifyDto, PaymentVerifyResponse>(EVENTS.PAYMENT.VERIFY, dto);
  }

  /**
   * GET /payments/order/:orderId
   * Lấy payment theo order ID
   * Note: Phải đặt route này TRƯỚC :id route để tránh conflict
   */
  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string): Promise<PaymentResponse> {
    return this.send<{ orderId: string }, PaymentResponse>(EVENTS.PAYMENT.GET_BY_ORDER, {
      orderId,
    });
  }

  /**
   * GET /payments/:id
   * Lấy chi tiết payment theo ID
   */
  @Get(':id')
  findById(@Param('id') paymentId: string): Promise<PaymentResponse> {
    return this.send<{ paymentId: string }, PaymentResponse>(EVENTS.PAYMENT.GET_BY_ID, {
      paymentId,
    });
  }
}
