import { NestFactory } from '@nestjs/core';
import { CartAppModule } from '@cart-app/cart-app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Khởi động Cart Microservice
 *
 * Thiết lập và cấu hình microservice quản lý giỏ hàng bao gồm:
 * - Kết nối NATS để trao đổi dữ liệu với các service khác
 * - Validation tự động cho tất cả dữ liệu đầu vào
 * - Xử lý lỗi tập trung cho RPC calls
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(CartAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'cart-app',
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
  console.log(' [Cart Service] is listening on NATS');
}
void bootstrap();
