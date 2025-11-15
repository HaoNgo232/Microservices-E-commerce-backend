/**
 * Thư viện Exception RPC dùng chung
 *
 * Chuẩn hoá việc xử lý lỗi giữa các microservice.
 * Thay thế RpcException chung bằng các exception có kiểu dữ liệu rõ ràng.
 */

import { RpcException } from '@nestjs/microservices';
import { HttpStatus } from '@nestjs/common';

/**
 * Base RPC Exception with structured error format
 */
export interface RpcErrorPayload {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
  timestamp?: string;
}

/**
 * Entity not found exception (404)
 *
 * @example
 * throw new EntityNotFoundRpcException('User', userId);
 */
export class EntityNotFoundRpcException extends RpcException {
  constructor(entity: string, id: string | number) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      message: `${entity} với ID ${id} không tồn tại`,
      error: 'Not Found',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Validation exception (400)
 *
 * @example
 * throw new ValidationRpcException('Email đã tồn tại');
 */
export class ValidationRpcException extends RpcException {
  constructor(message: string, details?: unknown) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Validation Error',
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Conflict exception (409)
 *
 * @example
 * throw new ConflictRpcException('Email đã được sử dụng');
 */
export class ConflictRpcException extends RpcException {
  constructor(message: string, details?: unknown) {
    super({
      statusCode: HttpStatus.CONFLICT,
      message,
      error: 'Conflict',
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Unauthorized exception (401)
 *
 * @example
 * throw new UnauthorizedRpcException('Token không hợp lệ');
 */
export class UnauthorizedRpcException extends RpcException {
  constructor(message: string = 'Unauthorized') {
    super({
      statusCode: HttpStatus.UNAUTHORIZED,
      message,
      error: 'Unauthorized',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Forbidden exception (403)
 *
 * @example
 * throw new ForbiddenRpcException('Không có quyền truy cập');
 */
export class ForbiddenRpcException extends RpcException {
  constructor(message: string = 'Forbidden') {
    super({
      statusCode: HttpStatus.FORBIDDEN,
      message,
      error: 'Forbidden',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Service unavailable exception (503)
 *
 * @example
 * throw new ServiceUnavailableRpcException('Database connection failed');
 */
export class ServiceUnavailableRpcException extends RpcException {
  constructor(message: string = 'Service temporarily unavailable') {
    super({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message,
      error: 'Service Unavailable',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Internal server error exception (500)
 *
 * @example
 * throw new InternalServerRpcException('Unexpected error occurred', error);
 */
export class InternalServerRpcException extends RpcException {
  constructor(message: string = 'Internal server error', details?: unknown) {
    super({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      error: 'Internal Server Error',
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
