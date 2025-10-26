import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  PaymentProcessDto,
  PaymentVerifyDto,
  PaymentIdDto,
  PaymentByOrderDto,
  SePayWebhookDto,
} from '@shared/dto/payment.dto';
import { PrismaService } from '@payment-app/prisma/prisma.service';
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
} from '@shared/exceptions/rpc-exceptions';
import {
  PaymentResponse,
  PaymentProcessResponse,
  PaymentVerifyResponse,
} from '@shared/types/payment.types';
import { SePayWebhookResponse } from '@shared/types/payment.webhook.types';
import { EVENTS } from '@shared/events';
import { catchError, timeout, throwError, firstValueFrom } from 'rxjs';
import { OrderResponse } from '@shared/types';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  /**
   * Process payment for an order
   * Supports COD and SePay methods
   */
  async process(dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    try {
      // Validate order exists and is in PENDING status
      await this.validateOrderForPayment(dto.orderId);

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          orderId: dto.orderId,
          method: dto.method,
          amountInt: dto.amountInt,
          status: dto.method === 'COD' ? 'PENDING' : 'PENDING',
          payload: false,
        },
      });

      // Handle payment method
      if (dto.method === 'COD') {
        // COD: Payment completed immediately
        await this.completePayment(payment.id, dto.orderId);

        return {
          paymentId: payment.id,
          status: 'SUCCESS',
          message: 'COD payment processed successfully',
        };
      }

      // SePay: Generate mock payment URL
      const paymentUrl = `https://sepay.vn/payment/${payment.id}`;

      return {
        paymentId: payment.id,
        status: 'PENDING',
        paymentUrl,
        message: 'Redirect to payment gateway',
      };
    } catch (error) {
      if (error instanceof EntityNotFoundRpcException || error instanceof ValidationRpcException) {
        throw error;
      }
      console.error('[PaymentsService] process error:', error);
      throw new ValidationRpcException('Failed to process payment');
    }
  }

  /**
   * Verify payment from gateway callback
   * Updates payment and order status
   */
  async verify(dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
    try {
      // Find payment by orderId
      const payment = await this.prisma.payment.findFirst({
        where: { orderId: dto.orderId },
        orderBy: { createdAt: 'desc' },
      });

      if (!payment) {
        throw new EntityNotFoundRpcException('Payment', dto.orderId);
      }

      // Mock verification logic (in production, verify with actual gateway)
      const isValid = this.mockVerifyPaymentGateway(dto.payload);

      if (!isValid) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            payload: dto.payload as never,
          },
        });

        return {
          paymentId: payment.id,
          orderId: dto.orderId,
          status: 'FAILED',
          verified: false,
          message: 'Payment verification failed',
        };
      }

      // Update payment status
      await this.completePayment(payment.id, dto.orderId);

      return {
        paymentId: payment.id,
        orderId: dto.orderId,
        status: 'SUCCESS',
        verified: true,
        transactionId: (dto.payload.transactionId as string) || payment.id,
        message: 'Payment verified successfully',
      };
    } catch (error) {
      if (error instanceof EntityNotFoundRpcException) {
        throw error;
      }
      console.error('[PaymentsService] verify error:', error);
      throw new ValidationRpcException('Failed to verify payment');
    }
  }

  /**
   * Get payment by ID
   */
  async getById(dto: PaymentIdDto): Promise<PaymentResponse> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.id },
    });

    if (!payment) {
      throw new EntityNotFoundRpcException('Payment', dto.id);
    }

    return this.mapToPaymentResponse(payment);
  }

  /**
   * Get payment by order ID
   */
  async getByOrder(dto: PaymentByOrderDto): Promise<PaymentResponse> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new EntityNotFoundRpcException('Payment for order', dto.orderId);
    }

    return this.mapToPaymentResponse(payment);
  }

  /**
   * Validate order exists and is in correct status for payment
   * @private
   */
  private async validateOrderForPayment(orderId: string): Promise<void> {
    try {
      const order = (await firstValueFrom(
        this.orderClient.send(EVENTS.ORDER.GET, { id: orderId }).pipe(
          timeout(5000),
          catchError(error => {
            if (error instanceof Error && error.name === 'TimeoutError') {
              return throwError(
                () => new ValidationRpcException('Order service không phản hồi, vui lòng thử lại'),
              );
            }
            return throwError(() => new EntityNotFoundRpcException('Order', orderId));
          }),
        ),
      )) as OrderResponse;

      if (order.status !== 'PENDING') {
        throw new ValidationRpcException(
          `Cannot process payment for order with status: ${order.status}`,
        );
      }
    } catch (error: unknown) {
      if (error instanceof EntityNotFoundRpcException || error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[PaymentsService] validateOrderForPayment error:', error);
      throw new ValidationRpcException('Failed to validate order');
    }
  }

  /**
   * Complete payment and update order status
   * @private
   */
  private async completePayment(paymentId: string, orderId: string): Promise<void> {
    // Update payment status
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCESS' },
    });

    // Update order status to PAID (fire-and-forget)
    firstValueFrom(
      this.orderClient
        .send(EVENTS.ORDER.UPDATE_STATUS, {
          id: orderId,
          status: 'PAID',
        })
        .pipe(
          timeout(5000),
          catchError(error => {
            console.error('[PaymentsService] Failed to update order status:', error);
            return throwError(() => new Error('Failed to update order status'));
          }),
        ),
    ).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Mock payment gateway verification
   * In production, this would call actual payment gateway API
   * @private
   */
  private mockVerifyPaymentGateway(payload: Record<string, unknown>): boolean {
    // Mock verification logic
    // In production: verify signature, check transaction status, etc.
    return payload.status === 'success' || payload.verified === true;
  }

  /**
   * Map Prisma payment to PaymentResponse
   * @private
   */
  private mapToPaymentResponse(payment: {
    id: string;
    orderId: string;
    method: string;
    amountInt: number;
    status: string;
    payload: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentResponse {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      amountInt: payment.amountInt,
      status: payment.status,
      payload: payment.payload as Record<string, unknown> | null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Handle SePay Webhook
   * Called when bank transaction occurs
   * Process: Save transaction -> Extract orderId -> Validate -> Update payment & order
   */
  async handleSePayWebhook(dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
    try {
      // 1. Check for duplicate transaction (idempotency)
      const existingTransaction = await this.prisma.transaction.findUnique({
        where: { sePayId: dto.id },
      });

      if (existingTransaction) {
        console.log(`[PaymentsService] Duplicate webhook ignored: sePayId=${dto.id}`);
        return {
          success: true,
          message: 'Transaction already processed (duplicate webhook)',
        };
      }

      // 2. Save transaction to database
      const transactionDate = new Date(dto.transactionDate);
      const amountIn = dto.transferType === 'in' ? dto.transferAmount : 0;
      const amountOut = dto.transferType === 'out' ? dto.transferAmount : 0;

      await this.prisma.transaction.create({
        data: {
          sePayId: dto.id,
          gateway: dto.gateway,
          transactionDate,
          accountNumber: dto.accountNumber,
          subAccount: dto.subAccount,
          amountIn,
          amountOut,
          accumulated: dto.accumulated,
          code: dto.code,
          transactionContent: dto.content,
          referenceCode: dto.referenceCode,
          description: dto.description,
        },
      });

      // 3. Only process incoming transactions
      if (dto.transferType !== 'in') {
        return {
          success: true,
          message: 'Transaction saved (not an incoming payment)',
        };
      }

      // 4. Extract order ID from transaction content using regex
      // Pattern: DH123 or DH-123 or similar
      const orderIdMatch = new RegExp(/DH[-_]?(\d+)/i).exec(dto.content);

      if (!orderIdMatch) {
        console.log('[PaymentsService] No order ID found in transaction content');
        return {
          success: true,
          message: 'Transaction saved (no order ID in content)',
        };
      }

      const orderId = orderIdMatch[1];

      // 5. Find matching payment
      // Conditions: orderId matches, amount matches, status is PENDING
      const payment = await this.prisma.payment.findFirst({
        where: {
          orderId,
          amountInt: dto.transferAmount,
          status: 'PENDING',
        },
      });

      if (!payment) {
        console.log(
          `[PaymentsService] No matching payment found: orderId=${orderId}, amount=${dto.transferAmount}`,
        );
        return {
          success: true,
          message: 'Transaction saved (no matching pending payment)',
        };
      }

      // 6. Update payment status to SUCCESS
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          payload: {
            sePayTransactionId: dto.id,
            gateway: dto.gateway,
            referenceCode: dto.referenceCode,
            transactionDate: dto.transactionDate,
          } as never,
        },
      });

      // 7. Update order status to PAID (fire-and-forget)
      firstValueFrom(
        this.orderClient
          .send(EVENTS.ORDER.UPDATE_STATUS, {
            id: orderId,
            status: 'PAID',
          })
          .pipe(
            timeout(5000),
            catchError(error => {
              console.error('[PaymentsService] Failed to update order status:', error);
              return throwError(() => new Error('Failed to update order status'));
            }),
          ),
      ).catch(() => {
        // Ignore errors (fire-and-forget)
      });

      console.log(
        `[PaymentsService] Payment completed: orderId=${orderId}, paymentId=${payment.id}`,
      );

      return {
        success: true,
        message: 'Payment processed successfully',
        orderId,
        paymentId: payment.id,
      };
    } catch (error: unknown) {
      console.error('[PaymentsService] handleSePayWebhook error:', error);

      // Return success to SePay to avoid retry (we logged the error)
      return {
        success: false,
        message: 'Internal error processing webhook',
      };
    }
  }
}
