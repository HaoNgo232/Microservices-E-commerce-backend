import { HttpStatus } from '@nestjs/common';

/**
 * Trình phân tích lỗi (Error Parser)
 * Chuyển đổi lỗi (string/object) sang cấu trúc thống nhất: { statusCode, message, details }
 */
export class ErrorParser {
  /**
   * Phân tích lỗi và trích xuất statusCode, message, details
   */
  static parse(error: string | object): {
    statusCode: number;
    message: string;
    details: unknown;
  } {
    if (typeof error === 'object' && error !== null) {
      return this.parseObjectError(error);
    }

    if (typeof error === 'string') {
      return this.parseStringError(error);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      details: null,
    };
  }

  /**
   * Phân tích lỗi dạng object (đã có cấu trúc)
   */
  private static parseObjectError(error: object): {
    statusCode: number;
    message: string;
    details: unknown;
  } {
    const errorObj = error as Record<string, unknown>;

    const statusCode =
      'statusCode' in errorObj && typeof errorObj.statusCode === 'number'
        ? errorObj.statusCode
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = 'message' in errorObj ? String(errorObj.message) : 'Internal server error';

    const details = 'error' in errorObj ? errorObj.error : null;

    return { statusCode, message, details };
  }

  /**
   * Phân tích lỗi dạng string (dò pattern cơ bản)
   */
  private static parseStringError(error: string): {
    statusCode: number;
    message: string;
    details: unknown;
  } {
    const lowerError = error.toLowerCase();

    if (lowerError.includes('empty response')) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        details: null,
      };
    }

    if (lowerError.includes('timeout')) {
      return {
        statusCode: HttpStatus.REQUEST_TIMEOUT,
        message: 'Request timeout - service did not respond in time',
        details: null,
      };
    }

    if (lowerError.includes('not found')) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: error,
        details: null,
      };
    }

    if (lowerError.includes('unauthorized')) {
      return {
        statusCode: HttpStatus.UNAUTHORIZED,
        message: error,
        details: null,
      };
    }

    if (lowerError.includes('forbidden')) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: error,
        details: null,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error,
      details: null,
    };
  }

  /**
   * Lấy nội dung message từ lỗi cho ngữ cảnh RPC
   */
  static extractMessage(error: string | object): string {
    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }

    return 'Internal server error';
  }

  /**
   * Lấy statusCode từ lỗi cho ngữ cảnh RPC
   */
  static extractStatusCode(error: string | object): number {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      return (error as { statusCode: number }).statusCode;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
