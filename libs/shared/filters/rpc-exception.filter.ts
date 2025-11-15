import { Catch, RpcExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { Response } from 'express';
import { ErrorParser } from './error-parser';
import { ErrorResponseBuilder } from './error-response-builder';

/**
 * Bộ lọc xử lý lỗi RPC toàn hệ thống
 * Chuyển đổi các lỗi từ microservices NATS thành phản hồi HTTP chuẩn
 *
 * Hỗ trợ các loại lỗi:
 * - RpcException với mã trạng thái tùy chỉnh
 * - HttpException (NotFoundException, BadRequestException, v.v.)
 * - Dịch vụ không phản hồi
 * - Lỗi timeout kết nối
 * - Các lỗi chung khác
 */
@Catch()
export class AllRpcExceptionsFilter implements RpcExceptionFilter<RpcException> {
  catch(exception: RpcException, host: ArgumentsHost): Observable<never> {
    const contextType = host.getType();

    // Xử lý context HTTP (Gateway)
    if (contextType === 'http') {
      this.handleHttpException(exception, host);
      // Trả về Observable để thỏa mãn interface contract
      return throwError(() => ({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Exception handled',
      }));
    }

    // Xử lý context RPC (Microservices)
    return this.handleRpcException(exception);
  }

  /**
   * Xử lý lỗi trong context HTTP (Gateway)
   * Giao việc cho các helper để xử lý chi tiết
   */
  private handleHttpException(exception: RpcException | Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Chuyển đổi các ngoại lệ NestJS tiêu chuẩn sang định dạng RPC
    const rawError = this.normalizeException(exception);

    // Phân tích lỗi thành định dạng có cấu trúc
    const { statusCode, message, details } = ErrorParser.parse(rawError);

    // Xây dựng và gửi phản hồi HTTP
    const errorResponse = ErrorResponseBuilder.buildHttpResponse(statusCode, message, details);

    console.error('[RpcException]', errorResponse);
    response.status(errorResponse.statusCode).json(errorResponse);
  }

  /**
   * Xử lý lỗi trong context RPC (Microservices)
   */
  private handleRpcException(exception: RpcException | Error): Observable<never> {
    // Chuyển đổi các ngoại lệ NestJS tiêu chuẩn sang định dạng RPC
    const rawError = this.normalizeException(exception);

    // Trích xuất thông tin lỗi
    const statusCode = ErrorParser.extractStatusCode(rawError);
    const message = ErrorParser.extractMessage(rawError);

    // Xây dựng phản hồi RPC
    const errorResponse = ErrorResponseBuilder.buildRpcResponse(statusCode, message);

    console.error('[RpcException]', errorResponse);
    return throwError(() => errorResponse);
  }

  /**
   * Chuẩn hóa lỗi về định dạng RPC
   * Biến đổi HttpException sang định dạng RPC để xử lý thống nhất
   */
  private normalizeException(exception: RpcException | Error): string | object {
    // Nếu đã là RpcException, trả về nguyên trạng
    if (exception instanceof RpcException) {
      return exception.getError();
    }

    // Chuyển đổi Error tiêu chuẩn sang định dạng có cấu trúc
    if (exception instanceof Error) {
      // Kiểm tra xem có phải là HttpException của NestJS bằng duck-typing
      const httpException = exception as {
        getStatus?: () => number;
        getResponse?: () => string | object;
        message: string;
      };

      if (typeof httpException.getStatus === 'function') {
        const statusCode = httpException.getStatus();
        const response = httpException.getResponse?.() || exception.message;

        return {
          statusCode,
          message:
            typeof response === 'string' ? response : (response as { message: string }).message || exception.message,
        };
      }

      // Lỗi chung
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Internal server error',
      };
    }

    // Loại ngoại lệ không xác định
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }
}
