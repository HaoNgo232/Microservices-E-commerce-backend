import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PaymentsService } from '@payment-app/payments/payments.service';
import { EVENTS } from '@shared/events';
import {
  PaymentProcessDto,
  PaymentVerifyDto,
  PaymentIdDto,
  PaymentByOrderDto,
  SePayWebhookDto,
} from '@shared/dto/payment.dto';
import {
  PaymentResponse,
  PaymentProcessResponse,
  PaymentVerifyResponse,
} from '@shared/types/payment.types';
import { SePayWebhookResponse } from '@shared/types/payment.webhook.types';

/**
 * PaymentsController - NATS Message Handler cho Payments
 *
 * Xử lý các NATS messages liên quan đến thanh toán:
 * - WEBHOOK_SEPAY: Nhận webhook từ SePay khi có giao dịch
 * - PROCESS: Xử lý thanh toán cho order (COD hoặc SePay)
 * - VERIFY: Xác thực thanh toán từ payment gateway
 * - CONFIRM_COD: Confirm COD payment đã thu tiền (admin/shipper)
 * - GET_BY_ID: Lấy thông tin payment theo ID
 * - GET_BY_ORDER: Lấy thông tin payment theo order ID
 *
 * **Note:** Controller chỉ route messages, business logic ở PaymentsService
 */
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * NATS Handler: Nhận webhook từ SePay
   *
   * Pattern: payment.webhook.sepay
   * @param dto - Dữ liệu giao dịch từ SePay
   * @returns Kết quả xử lý webhook
   */
  @MessagePattern(EVENTS.PAYMENT.WEBHOOK_SEPAY)
  sepayWebhook(@Payload() dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
    return this.paymentsService.handleSePayWebhook(dto);
  }

  /**
   * NATS Handler: Xử lý thanh toán cho order
   *
   * Pattern: payment.process
   * @param dto - Thông tin thanh toán (orderId, method, amount)
   * @returns Payment URL (SePay) hoặc success status (COD)
   */
  @MessagePattern(EVENTS.PAYMENT.PROCESS)
  process(@Payload() dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    return this.paymentsService.process(dto);
  }

  /**
   * NATS Handler: Xác thực thanh toán từ gateway callback
   *
   * Pattern: payment.verify
   * @param dto - Payload từ payment gateway
   * @returns Kết quả xác thực payment
   */
  @MessagePattern(EVENTS.PAYMENT.VERIFY)
  verify(@Payload() dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
    return this.paymentsService.verify(dto);
  }

  /**
   * NATS Handler: Confirm COD payment đã thu tiền
   *
   * Pattern: payment.confirmCod
   * @param dto - { id } hoặc { orderId }
   * @returns Kết quả confirm payment
   */
  @MessagePattern(EVENTS.PAYMENT.CONFIRM_COD)
  confirmCod(@Payload() dto: PaymentIdDto | PaymentByOrderDto): Promise<PaymentResponse> {
    return this.paymentsService.confirmCodPayment(dto);
  }

  /**
   * NATS Handler: Lấy thông tin payment theo ID
   *
   * Pattern: payment.getById
   * @param dto - { id }
   * @returns Thông tin payment
   */
  @MessagePattern(EVENTS.PAYMENT.GET_BY_ID)
  getById(@Payload() dto: PaymentIdDto): Promise<PaymentResponse> {
    return this.paymentsService.getById(dto);
  }

  /**
   * NATS Handler: Lấy thông tin payment theo order ID
   *
   * Pattern: payment.getByOrder
   * @param dto - { orderId }
   * @returns Thông tin payment mới nhất của order
   */
  @MessagePattern(EVENTS.PAYMENT.GET_BY_ORDER)
  getByOrder(@Payload() dto: PaymentByOrderDto): Promise<PaymentResponse> {
    return this.paymentsService.getByOrder(dto);
  }
}
