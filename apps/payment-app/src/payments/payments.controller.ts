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

@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @MessagePattern(EVENTS.PAYMENT.WEBHOOK_SEPAY)
  sepayWebhook(@Payload() dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
    return this.paymentsService.handleSePayWebhook(dto);
  }

  @MessagePattern(EVENTS.PAYMENT.PROCESS)
  process(@Payload() dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    return this.paymentsService.process(dto);
  }

  @MessagePattern(EVENTS.PAYMENT.VERIFY)
  verify(@Payload() dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
    return this.paymentsService.verify(dto);
  }

  @MessagePattern(EVENTS.PAYMENT.GET_BY_ID)
  getById(@Payload() dto: PaymentIdDto): Promise<PaymentResponse> {
    return this.paymentsService.getById(dto);
  }

  @MessagePattern(EVENTS.PAYMENT.GET_BY_ORDER)
  getByOrder(@Payload() dto: PaymentByOrderDto): Promise<PaymentResponse> {
    return this.paymentsService.getByOrder(dto);
  }
}
