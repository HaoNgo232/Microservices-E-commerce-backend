import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Error } from '@shared/types';

/**
 * Gửi tin nhắn đến microservice với retry tự động
 *
 * Hàm tiện ích giúp gửi request đến các microservice với cơ chế:
 * - Timeout: 5s
 * - Retry: 1 lần sau 1s
 * - Chuyển lỗi RPC thành HttpException
 *
 * @template T - Kiểu dữ liệu phản hồi
 * @param client - ClientProxy của NestJS
 * @param pattern - Pattern tên service
 * @param data - Dữ liệu gửi kèm
 * @returns Phản hồi từ microservice
 * @throws HttpException khi lỗi sau các lần retry
 *
 * @example
 * const result = await sendWithRetry<User>(client, 'user.get', { id: 1 });
 */
export async function sendWithRetry<T>(client: ClientProxy, pattern: string, data: unknown): Promise<T> {
  return firstValueFrom(
    client.send<T>(pattern, data).pipe(
      timeout(5000),
      retry({ count: 1, delay: 1000 }),
      catchError((error: Error) => {
        throw new HttpException(
          error.message || 'Service communication failed',
          error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }),
    ),
  );
}
