/**
 * Bộ dựng (Builder) phản hồi lỗi chuẩn hoá
 * Tạo ra cấu trúc response đồng nhất cho HTTP và RPC
 */
export class ErrorResponseBuilder {
  /**
   * Tạo response lỗi cho HTTP
   *
   * @param statusCode Mã trạng thái HTTP
   * @param message Thông điệp lỗi cho người dùng
   * @param details Thông tin chi tiết (nếu có)
   */
  static buildHttpResponse(
    statusCode: number,
    message: string,
    details: unknown,
  ): {
    statusCode: number;
    message: string;
    error?: string;
    details?: unknown;
    timestamp: string;
  } {
    const errorResponse: {
      statusCode: number;
      message: string;
      error?: string;
      details?: unknown;
      timestamp: string;
    } = {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };

    if (details) {
      errorResponse.details = details;
    }

    if (statusCode >= 500) {
      errorResponse.error = 'Internal Server Error';
    }

    return errorResponse;
  }

  /**
   * Tạo response lỗi cho RPC (object đơn giản)
   *
   * @param statusCode Mã trạng thái
   * @param message Thông điệp lỗi
   */
  static buildRpcResponse(
    statusCode: number,
    message: string,
  ): {
    statusCode: number;
    message: string;
    timestamp: string;
  } {
    return {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    };
  }
}
