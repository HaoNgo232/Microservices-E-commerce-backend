import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Error } from '@shared/types';

/**
 * Gửi tin nhắn đến microservice với cơ chế retry tự động.
 *
 * @template T - Kiểu dữ liệu của response
 * @param client - NestJS ClientProxy để gửi tin nhắn
 * @param pattern - Tên pattern của microservice
 * @param data - Dữ liệu gửi đi
 * @returns Promise chứa response từ microservice
 * @throws HttpException nếu lỗi sau khi retry
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
