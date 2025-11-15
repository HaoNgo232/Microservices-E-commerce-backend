import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, retry, catchError, throwError } from 'rxjs';

/**
 * SendOptions - Tùy chọn cho việc gửi message qua NATS
 *
 * @property timeout - Thời gian timeout (ms)
 * @property retryCount - Số lần retry khi thất bại
 * @property retryDelay - Thời gian delay giữa các lần retry (ms)
 */
export interface SendOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * BaseGatewayController - Lớp cơ sở cho tất cả Gateway Controllers
 *
 * Cung cấp unified communication layer với NATS cho tất cả controllers.
 * Áp dụng Template Method Pattern để định nghĩa skeleton của NATS communication.
 *
 * **Chức năng chính:**
 * - Gửi request-response messages với timeout và retry
 * - Gửi event không chờ phản hồi
 * - Xử lý lỗi tập trung và convert sang HTTP exceptions
 *
 * @example
 * ```typescript
 * class UsersController extends BaseGatewayController {
 *   constructor(@Inject('USER_SERVICE') client: ClientProxy) {
 *     super(client);
 *   }
 *
 *   async findById(id: string): Promise<UserResponse> {
 *     return this.send(EVENTS.USER.FIND_BY_ID, id);
 *   }
 * }
 * ```
 */
export abstract class BaseGatewayController {
  /**
   * Constructor - Inject NATS ClientProxy
   *
   * @param client - NATS client để giao tiếp với microservices
   */
  constructor(protected readonly client: ClientProxy) {}

  /**
   * Gửi request-response message đến microservice qua NATS
   *
   * @param pattern - NATS event pattern
   * @param data - Request payload
   * @param options - Timeout và retry configuration
   * @returns Promise với typed response
   *
   * @throws HttpException với status code tương ứng nếu có lỗi
   */
  protected async send<TRequest, TResponse>(
    pattern: string,
    data: TRequest,
    options: SendOptions = {},
  ): Promise<TResponse> {
    const { timeout: timeoutMs = 5000, retryCount = 1, retryDelay = 1000 } = options;

    return firstValueFrom(
      this.client.send<TResponse, TRequest>(pattern, data).pipe(
        timeout(timeoutMs),
        retry({ count: retryCount, delay: retryDelay }),
        catchError((error: unknown) => throwError(() => this.createHttpError(error, pattern))),
      ),
    );
  }

  /**
   * Gửi event không chờ phản hồi đến microservice qua NATS
   * Không chờ phản hồi, phù hợp cho logging hoặc notifications
   *
   * @param pattern - NATS event pattern
   * @param data - Event payload
   */
  protected emit<TEvent>(pattern: string, data: TEvent): void {
    this.client.emit<void, TEvent>(pattern, data);
  }

  /**
   * Xử lý lỗi tập trung cho NATS communication
   * Phân tích lỗi từ microservice và chuyển đổi thành HTTP exception
   *
   * @param error - Lỗi từ microservice
   * @param pattern - NATS event pattern
   * @returns HttpException với status code phù hợp
   */
  private createHttpError(error: unknown, pattern: string): HttpException {
    console.error(`[Gateway] Error calling ${pattern}:`, error);

    // Timeout error - check name property first
    if (this.isTimeoutError(error)) {
      return new HttpException('Service request timeout', HttpStatus.REQUEST_TIMEOUT);
    }

    // Phân tích lỗi từ microservice (RPC error)
    if (this.isRpcError(error)) {
      return new HttpException(
        error.message || 'Service communication failed',
        error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Generic error
    return new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * Type guard để kiểm tra timeout error
   *
   * @param error - Đối tượng lỗi cần kiểm tra
   * @returns true nếu là timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    return (
      (error instanceof Error && error.name === 'TimeoutError') ||
      (typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError')
    );
  }

  /**
   * Type guard để kiểm tra RPC error format
   *
   * @param error - Đối tượng lỗi cần kiểm tra
   * @returns true nếu có cấu trúc RPC error (message + statusCode)
   */
  private isRpcError(error: unknown): error is { message: string; statusCode: number } {
    return typeof error === 'object' && error !== null && 'message' in error && 'statusCode' in error;
  }
}
