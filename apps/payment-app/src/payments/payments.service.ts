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
import { EntityNotFoundRpcException, ValidationRpcException } from '@shared/exceptions/rpc-exceptions';
import {
  PaymentResponse,
  PaymentProcessResponse,
  PaymentVerifyResponse,
  PaymentMethod,
  PaymentStatus,
} from '@shared/types/payment.types';
import { SePayWebhookResponse } from '@shared/types/payment.webhook.types';
import { EVENTS } from '@shared/events';
import { catchError, timeout, throwError, firstValueFrom } from 'rxjs';
import { OrderResponse, OrderStatus } from '@shared/types';

/**
 * Interface cho Payment Service - quản lý các thao tác thanh toán
 * Cung cấp các phương thức xử lý, xác thực và lấy thông tin thanh toán
 */
export interface IPaymentService {
  /**
   * Xử lý giao dịch thanh toán
   * @param dto - Chi tiết xử lý thanh toán
   * @returns Promise chứa phản hồi xử lý thanh toán
   */
  process(dto: PaymentProcessDto): Promise<PaymentProcessResponse>;

  /**
   * Xác thực giao dịch thanh toán
   * @param dto - Chi tiết xác thực thanh toán
   * @returns Promise chứa phản hồi xác thực thanh toán
   */
  verify(dto: PaymentVerifyDto): Promise<PaymentVerifyResponse>;

  /**
   * Lấy thông tin thanh toán theo ID
   * @param dto - Chi tiết ID thanh toán
   * @returns Promise chứa thông tin thanh toán
   */
  getById(dto: PaymentIdDto): Promise<PaymentResponse>;

  /**
   * Lấy thông tin thanh toán theo ID đơn hàng
   * @param dto - Chi tiết ID đơn hàng
   * @returns Promise chứa thông tin thanh toán
   */
  getByOrder(dto: PaymentByOrderDto): Promise<PaymentResponse>;

  /**
   * Xác nhận thanh toán COD (Thanh toán khi nhận hàng)
   * @param dto - Chi tiết ID thanh toán hoặc ID đơn hàng
   * @returns Promise chứa thông tin thanh toán đã được cập nhật
   */
  confirmCodPayment(dto: PaymentIdDto | PaymentByOrderDto): Promise<PaymentResponse>;

  /**
   * Xử lý webhook từ cổng thanh toán SePay
   * @param dto - Dữ liệu sự kiện webhook từ SePay
   * @returns Promise chứa phản hồi webhook
   */
  handleSePayWebhook(dto: SePayWebhookDto): Promise<SePayWebhookResponse>;
}

/**
 * PaymentsService - Service xử lý thanh toán
 *
 * Xử lý business logic liên quan đến:
 * - Xử lý thanh toán COD (hoàn thành ngay lập tức)
 * - Xử lý thanh toán SePay (tạo payment URL, chờ webhook)
 * - Xác thực thanh toán từ gateway callback
 * - Nhận và xử lý webhook từ SePay khi có giao dịch
 * - Lưu trữ transaction history
 *
 * **Tích hợp microservices:**
 * - Order Service: Validate order, cập nhật trạng thái order sang PAID
 *
 * **Payment Methods:**
 * - COD (Cash on Delivery): Thanh toán khi nhận hàng
 * - SePay: Chuyển khoản ngân hàng qua SePay gateway
 */
@Injectable()
export class PaymentsService implements IPaymentService {
  /**
   * Constructor - Inject dependencies
   *
   * @param prisma - Prisma client để truy cập database
   * @param orderClient - NATS client gọi Order Service
   */
  constructor(
    private readonly prisma: PrismaService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  /**
   * Xử lý thanh toán cho order
   *
   * Luồng xử lý:
   * 1. Kiểm tra order tồn tại và ở trạng thái PENDING
   * 2. Tạo payment record ở trạng thái UNPAID
   * 3. COD: Hoàn thành thanh toán ngay, cập nhật order sang PAID
   * 4. SePay: Tạo payment URL, trả về cho client để redirect
   *
   * @param dto - Thông tin thanh toán (orderId, method, amountInt)
   * @returns Payment URL (SePay) hoặc success status (COD)
   * @throws ValidationRpcException nếu order không hợp lệ
   */
  async process(dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    try {
      // Kiểm tra order tồn tại và đang ở trạng thái PENDING
      await this.validateOrderForPayment(dto.orderId);

      // Tạo hồ sơ thanh toán
      const payment = await this.prisma.payment.create({
        data: {
          orderId: dto.orderId,
          method: dto.method,
          amountInt: dto.amountInt,
          status: PaymentStatus.UNPAID,
          payload: false,
        },
      });

      // Handle payment method
      if (dto.method === PaymentMethod.COD) {
        await this.updateOrderStatus(dto.orderId, OrderStatus.PROCESSING);

        return {
          paymentId: payment.id,
          status: PaymentStatus.UNPAID,
          message: 'COD payment created - will be completed on delivery',
        };
      }

      // SePay: Kiểm tra biến môi trường trước khi tạo QR
      if (!process.env.SEPAY_ACCOUNT_NUMBER) {
        throw new ValidationRpcException(
          'SePay configuration missing: SEPAY_ACCOUNT_NUMBER không được cấu hình. ' +
            'Với BIDV, bạn PHẢI dùng số tài khoản ảo (VA) thay vì số tài khoản chính. ' +
            'VD: 96247HAOVA. Đăng ký VA tại https://my.sepay.vn',
        );
      }

      if (!process.env.SEPAY_BANK_NAME) {
        throw new ValidationRpcException(
          'SePay configuration missing: SEPAY_BANK_NAME không được cấu hình. Vui lòng thêm tên ngân hàng (BIDV, MBBank, etc.) vào file .env',
        );
      }

      if (!process.env.ACCOUNT_NAME) {
        throw new ValidationRpcException(
          'SePay configuration missing: ACCOUNT_NAME (tên tài khoản ảo) không được cấu hình. ' +
            'Đây là BẮT BUỘC để webhook hoạt động. ' +
            'Vui lòng đăng ký tài khoản ảo tại https://my.sepay.vn và thêm ACCOUNT_NAME vào .env',
        );
      }

      // SePay: Tạo VietQR URL với accountName (BẮT BUỘC cho webhook)
      const qrCodeUrl = this.generateSePayQRUrl(
        process.env.SEPAY_ACCOUNT_NUMBER,
        process.env.SEPAY_BANK_NAME,
        process.env.ACCOUNT_NAME,
        dto.amountInt,
        dto.orderId,
      );

      return {
        paymentId: payment.id,
        status: PaymentStatus.UNPAID,
        paymentUrl: qrCodeUrl,
        qrCode: qrCodeUrl,
        message: 'SePay payment created',
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
   * Xác thực thanh toán từ gateway callback
   *
   * Luồng xử lý:
   * 1. Tìm payment theo orderId
   * 2. Verify payload từ gateway (mock verification)
   * 3. Nếu hợp lệ: Cập nhật payment và order sang PAID
   * 4. Nếu không hợp lệ: Giữ payment ở trạng thái UNPAID
   *
   * @param dto - Payload từ payment gateway
   * @returns Kết quả xác thực với verified flag
   * @throws EntityNotFoundRpcException nếu payment không tồn tại
   * @throws ValidationRpcException nếu có lỗi xử lý
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

      // Đoạn xác thực giả lập (ở production cần xác thực với gateway thực tế)
      const isValid = this.mockVerifyPaymentGateway(dto.payload);

      if (!isValid) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'UNPAID',
            payload: dto.payload as never,
          },
        });

        return {
          paymentId: payment.id,
          orderId: dto.orderId,
          status: PaymentStatus.UNPAID,
          verified: false,
          message: 'Payment verification failed',
        };
      }

      // Update payment status
      await this.completePayment(payment.id, dto.orderId);

      return {
        paymentId: payment.id,
        orderId: dto.orderId,
        status: PaymentStatus.PAID,
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
   * Lấy thông tin payment theo ID
   *
   * @param dto - { id }
   * @returns Thông tin payment
   * @throws EntityNotFoundRpcException nếu payment không tồn tại
   */
  async getById(dto: PaymentIdDto): Promise<PaymentResponse> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.id },
    });

    if (!payment) {
      throw new EntityNotFoundRpcException('Payment', dto.id);
    }

    return payment as PaymentResponse;
  }

  /**
   * Lấy thông tin payment theo order ID
   *
   * @param dto - { orderId }
   * @returns Payment mới nhất của order (sắp xếp theo createdAt desc)
   * @throws EntityNotFoundRpcException nếu payment không tồn tại
   */
  async getByOrder(dto: PaymentByOrderDto): Promise<PaymentResponse> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      throw new EntityNotFoundRpcException('Payment for order', dto.orderId);
    }

    return payment as PaymentResponse;
  }

  /**
   * Confirm COD payment đã thu tiền
   *
   * Dùng khi admin/shipper đã giao hàng và thu tiền từ khách hàng.
   * Chỉ áp dụng cho COD payments.
   *
   * Luồng xử lý:
   * 1. Tìm payment theo ID hoặc orderId
   * 2. Kiểm tra phương thức thanh toán = COD và trạng thái = UNPAID
   * 3. Update payment status → PAID
   * 4. Cập nhật trạng thái order → PAID (không chờ phản hồi)
   *
   * @param dto - { id } hoặc { orderId }
   * @returns Payment đã được confirm
   * @throws EntityNotFoundRpcException nếu payment không tồn tại
   * @throws ValidationRpcException nếu không phải COD hoặc đã PAID
   */
  async confirmCodPayment(dto: PaymentIdDto | PaymentByOrderDto): Promise<PaymentResponse> {
    try {
      // Find payment by id or orderId
      let payment: PaymentResponse | null = null;

      if ('id' in dto) {
        payment = (await this.prisma.payment.findUnique({
          where: { id: dto.id },
        })) as PaymentResponse | null;
      } else {
        payment = (await this.prisma.payment.findFirst({
          where: { orderId: dto.orderId },
          orderBy: { createdAt: 'desc' },
        })) as PaymentResponse | null;
      }

      if (!payment) {
        const identifier = 'id' in dto ? dto.id : dto.orderId;
        throw new EntityNotFoundRpcException('Payment', identifier);
      }

      // Kiểm tra payment là COD
      if (payment.method !== PaymentMethod.COD) {
        throw new ValidationRpcException(`Cannot confirm non-COD payment. Payment method: ${payment.method}`);
      }

      // Kiểm tra payment chưa ở trạng thái PAID
      if (payment.status === PaymentStatus.PAID) {
        throw new ValidationRpcException('Payment already confirmed');
      }

      // Update payment status to PAID
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.PAID,
          payload: {
            confirmedAt: new Date().toISOString(),
            method: 'manual_cod_confirmation',
          } as never,
        },
      });

      // Cập nhật order.paymentStatus → PAID (không chờ phản hồi)
      firstValueFrom(
        this.orderClient
          .send(EVENTS.ORDER.UPDATE_PAYMENT_STATUS, {
            id: payment.orderId,
            paymentStatus: PaymentStatus.PAID,
          })
          .pipe(
            timeout(5000),
            catchError(error => {
              console.error('[PaymentsService] Failed to update order paymentStatus:', error);
              return throwError(() => new Error('Failed to update order payment status'));
            }),
          ),
      ).catch(() => {
        // Bỏ qua lỗi (không chờ phản hồi)
      });

      console.log(`[PaymentsService] COD payment confirmed: orderId=${payment.orderId}, paymentId=${payment.id}`);

      return updatedPayment as PaymentResponse;
    } catch (error: unknown) {
      if (error instanceof EntityNotFoundRpcException || error instanceof ValidationRpcException) {
        throw error;
      }
      console.error('[PaymentsService] confirmCodPayment error:', error);
      throw new ValidationRpcException('Failed to confirm COD payment');
    }
  }

  /**
   * Xử lý SePay Webhook
   *
   * Được gọi khi có giao dịch ngân hàng qua SePay gateway.
   *
   * Quy trình xử lý:
   * 1. Kiểm tra duplicate transaction (idempotency) theo sePayId
   * 2. Lưu transaction vào database
   * 3. Chỉ xử lý giao dịch incoming (transferType = 'in')
   * 4. Extract order ID từ transaction content (pattern: DH123, DH-123)
   * 5. Tìm payment matching (orderId + amount + status UNPAID)
   * 6. Cập nhật payment status sang PAID
   * 7. Cập nhật trạng thái order sang PAID (không chờ phản hồi)
   *
   * **Idempotency:** Webhook có thể được gọi nhiều lần, service phải handle duplicate
   *
   * @param dto - Dữ liệu giao dịch từ SePay webhook
   * @returns Kết quả xử lý webhook
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
      // Pattern: DH{orderId} - orderId có thể là CUID (cmhild03q0004uxjsg6940pjb) hoặc số
      // Match: DH + order ID (CUID or numeric or alphanumeric-like). Use \w (letters, digits, underscore) and hyphen
      const orderIdMatch = /DH([\w-]+)/i.exec(dto.content);

      if (!orderIdMatch) {
        console.log('[PaymentsService] No order ID found in transaction content:', dto.content);
        return {
          success: true,
          message: 'Transaction saved (no order ID in content)',
        };
      }

      const orderId = orderIdMatch[1];
      console.log('[PaymentsService] Extracted order ID from webhook:', orderId);

      // 5. Find matching payment
      // Conditions: orderId matches, amount matches, status is UNPAID
      const payment = await this.prisma.payment.findFirst({
        where: {
          orderId,
          amountInt: dto.transferAmount,
          status: 'UNPAID',
        },
      });

      if (!payment) {
        console.log(`[PaymentsService] No matching payment found: orderId=${orderId}, amount=${dto.transferAmount}`);
        return {
          success: true,
          message: 'Transaction saved (no matching unpaid payment)',
        };
      }

      // 6. Update payment status to PAID
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          payload: {
            sePayTransactionId: dto.id,
            gateway: dto.gateway,
            referenceCode: dto.referenceCode,
            transactionDate: dto.transactionDate,
          } as never,
        },
      });

      // 7. Cập nhật order.paymentStatus → PAID (không chờ phản hồi)
      firstValueFrom(
        this.orderClient
          .send(EVENTS.ORDER.UPDATE_PAYMENT_STATUS, {
            id: orderId,
            paymentStatus: PaymentStatus.PAID,
          })
          .pipe(
            timeout(5000),
            catchError(error => {
              console.error('[PaymentsService] Failed to update order paymentStatus:', error);
              return throwError(() => new Error('Failed to update order payment status'));
            }),
          ),
      ).catch(() => {
        // Bỏ qua lỗi (không chờ phản hồi)
      });

      console.log(`[PaymentsService] Payment completed: orderId=${orderId}, paymentId=${payment.id}`);

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

  /**
   * Kiểm tra order tồn tại và có trạng thái hợp lệ để thanh toán
   *
   * Quy tắc:
   * - Order phải tồn tại
   * - Order phải ở trạng thái PENDING (chưa thanh toán)
   *
   * @param orderId - ID của order cần validate
   * @throws EntityNotFoundRpcException nếu order không tồn tại
   * @throws ValidationRpcException nếu order không ở trạng thái PENDING
   * @private
   */
  private async validateOrderForPayment(orderId: string): Promise<void> {
    try {
      const order = (await firstValueFrom(
        this.orderClient.send(EVENTS.ORDER.GET, { id: orderId }).pipe(
          timeout(5000),
          catchError(error => {
            if (error instanceof Error && error.name === 'TimeoutError') {
              return throwError(() => new ValidationRpcException('Order service không phản hồi, vui lòng thử lại'));
            }
            return throwError(() => new EntityNotFoundRpcException('Order', orderId));
          }),
        ),
      )) as OrderResponse;

      if (order.status !== OrderStatus.PENDING) {
        throw new ValidationRpcException(`Cannot process payment for order with status: ${order.status}`);
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
   * Hoàn thành thanh toán và cập nhật trạng thái order
   *
   * Luồng xử lý:
   * 1. Cập nhật payment status sang PAID
   * 2. Cập nhật trạng thái order sang PAID (không chờ phản hồi)
   *
   * @param paymentId - ID của payment cần cập nhật
   * @param orderId - ID của order cần cập nhật
   * @private
   */
  private async completePayment(paymentId: string, orderId: string): Promise<void> {
    // Update payment status
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID' },
    });

    // Cập nhật order.paymentStatus → PAID (không chờ phản hồi)
    firstValueFrom(
      this.orderClient
        .send(EVENTS.ORDER.UPDATE_PAYMENT_STATUS, {
          id: orderId,
          paymentStatus: PaymentStatus.PAID,
        })
        .pipe(
          timeout(5000),
          catchError(error => {
            console.error('[PaymentsService] Failed to update order paymentStatus:', error);
            return throwError(() => new Error('Failed to update order payment status'));
          }),
        ),
    ).catch(() => {
      // Ignore errors
    });
  }

  /**
   * Helper: cập nhật Order status qua NATS với timeout
   */
  private async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await firstValueFrom(
      this.orderClient.send(EVENTS.ORDER.UPDATE_STATUS, { id: orderId, status }).pipe(
        timeout(5000),
        catchError(error => {
          console.error('[PaymentsService] Failed to update order status:', error);
          return throwError(() => new Error('Failed to update order status'));
        }),
      ),
    ).catch(() => {
      // không chờ phản hồi
    });
  }

  /**
   * Mock xác thực payment gateway
   *
   * Trong production, method này sẽ gọi API thực tế của payment gateway
   * để verify signature, check transaction status, etc.
   *
   * @param payload - Payload từ payment gateway
   * @returns true nếu hợp lệ, false nếu không hợp lệ
   * @private
   */
  private mockVerifyPaymentGateway(payload: Record<string, unknown>): boolean {
    // Kiểm tra giả lập (chỉ dùng trong môi trường dev); ở production cần verify thực tế với cổng thanh toán
    // Trong môi trường production: kiểm tra chữ ký, trạng thái giao dịch, v.v.
    return payload.status === 'success' || payload.verified === true;
  }

  /**
   * Generate SePay QR URL theo chuẩn VietQR với accountName
   * Docs: https://sepay.vn/lap-trinh-cong-thanh-toan.html
   *
   * URL format: https://qr.sepay.vn/img?acc=SO_TAI_KHOAN&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG&accountName=TEN_TAI_KHOAN&template=compact
   *
   * Lưu ý quan trọng cho BIDV:
   * - BIDV API không đồng bộ giao dịch qua tài khoản chính
   * - Cần dùng số tài khoản ảo (VA - Virtual Account)
   * - Format VA: {SốChính}{Mã} — ví dụ: "96247HAOVA"
   * - `accountName` là tên hiển thị trên QR (tên người nhận)
   * - Tài khoản ảo phải được đăng ký tại https://my.sepay.vn trước
   * - SePay nhận diện giao dịch qua số VA và pattern trong nội dung (ví dụ: DH123)
   * - Webhook sẽ không hoạt động nếu thiếu `accountName` hoặc chưa đăng ký VA
   *
   * @param accountNo - Số tài khoản ảo (VA) - VD: "96247HAOVA" (KHÔNG dùng số tài khoản chính)
   * @param bankName - Tên ngân hàng (VD: "BIDV", "MBBank", "Vietcombank")
   * @param accountName - Tên hiển thị trên QR (tên tài khoản ảo đã đăng ký với SePay)
   * @param amount - Số tiền (integer, đơn vị VND)
   * @param orderId - ID đơn hàng (sẽ thêm prefix DH)
   * @returns URL QR code SePay
   */
  private generateSePayQRUrl(
    accountNo: string,
    bankName: string,
    accountName: string,
    amount: number,
    orderId: string,
  ): string {
    const description = `DH${orderId}`;
    return `https://qr.sepay.vn/img?acc=${accountNo}&bank=${encodeURIComponent(bankName)}&amount=${amount}&des=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}&template=compact`;
  }
}
