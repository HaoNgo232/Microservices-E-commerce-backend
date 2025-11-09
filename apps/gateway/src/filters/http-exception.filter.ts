import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP Exception Filter
 * Format và log tất cả HTTP exceptions để debug dễ dàng hơn
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Log error để debug
    console.error('[HttpExceptionFilter]', {
      status,
      path: request.url,
      method: request.method,
      body: request.body,
      exception: exceptionResponse,
    });

    // Format response
    const errorResponse =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? exceptionResponse
        : {
            statusCode: status,
            message: exception.message,
            error: HttpStatus[status] || 'Unknown Error',
          };

    response.status(status).json(errorResponse);
  }
}

