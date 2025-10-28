import { HttpStatus } from '@nestjs/common';

/**
 * Cấu trúc lỗi đã được phân tích/chuẩn hoá
 */
export interface ParsedError {
  statusCode: number;
  message: string;
  details: unknown;
}

/**
 * Quy tắc phát hiện lỗi
 * Ánh xạ tập từ khoá → mã trạng thái HTTP và (tuỳ chọn) thông điệp thay thế
 */
interface ErrorPattern {
  keywords: string[];
  statusCode: number;
  message?: string;
}

/**
 * ErrorDetector
 * Nhiệm vụ: Nhận diện loại lỗi dựa trên mẫu câu (pattern) trong thông điệp
 *
 * Ghi chú học thuật (Thesis):
 * - Minh hoạ Strategy Pattern: mỗi pattern hoạt động như một “chiến lược”
 * - Dễ mở rộng bằng cách bổ sung pattern mà không cần sửa logic lõi (Open/Closed)
 */
export class ErrorDetector {
  /**
   * Tập pattern dựng sẵn.
   * Có thể mở rộng thêm bằng addPattern() mà không sửa logic enhance().
   */
  private readonly patterns: ErrorPattern[] = [
    {
      keywords: ['empty response'],
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Service temporarily unavailable',
    },
    {
      keywords: ['timeout'],
      statusCode: HttpStatus.REQUEST_TIMEOUT,
      message: 'Request timeout - service did not respond in time',
    },
    {
      keywords: ['not found'],
      statusCode: HttpStatus.NOT_FOUND,
    },
    {
      keywords: ['unauthorized'],
      statusCode: HttpStatus.UNAUTHORIZED,
    },
    {
      keywords: ['forbidden'],
      statusCode: HttpStatus.FORBIDDEN,
    },
    {
      keywords: ['bad request'],
      statusCode: HttpStatus.BAD_REQUEST,
    },
    {
      keywords: ['conflict'],
      statusCode: HttpStatus.CONFLICT,
    },
  ];

  /**
   * Nâng cao (enhance) thông tin lỗi bằng cách áp dụng nhận diện pattern.
   * Chỉ áp dụng khi statusCode hiện tại là 500 (lỗi tổng quát).
   *
   * @param parsedError Lỗi đã được chuẩn hoá
   * @returns Lỗi đã được cập nhật statusCode/message nếu khớp pattern
   */
  enhance(parsedError: ParsedError): ParsedError {
    if (parsedError.statusCode !== Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      return parsedError;
    }

    const message = parsedError.message.toLowerCase();
    const matchedPattern = this.findMatchingPattern(message);

    if (matchedPattern) {
      return {
        ...parsedError,
        statusCode: matchedPattern.statusCode,
        message: matchedPattern.message || parsedError.message,
      };
    }

    return parsedError;
  }

  /**
   * Tìm pattern đầu tiên khớp với thông điệp lỗi (không phân biệt hoa/thường).
   */
  private findMatchingPattern(message: string): ErrorPattern | null {
    for (const pattern of this.patterns) {
      if (this.matchesPattern(message, pattern.keywords)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Kiểm tra xem thông điệp có chứa bất kỳ từ khoá nào trong pattern hay không.
   */
  private matchesPattern(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Bổ sung pattern tuỳ biến trong runtime (tăng tính mở rộng).
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.push(pattern);
  }
}
