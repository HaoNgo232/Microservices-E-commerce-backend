import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { OrderAppModule } from '@order-app/order-app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Khởi động Order Microservice
 *
 * Thiết lập và cấu hình microservice quản lý đơn hàng bao gồm:
 * - Kết nối NATS để trao đổi dữ liệu với các service khác
 * - Validation tự động cho tất cả dữ liệu đầu vào
 * - Xử lý lỗi tập trung cho RPC calls
 * - Hàng đợi tin nhắn để xử lý song song
 *
 * **Chức năng chính:**
 * - Quản lý đơn hàng (tạo, cập nhật, hủy)
 * - Quản lý chi tiết đơn hàng
 * - Kiểm tra tồn kho và kết nối với Product Service
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(OrderAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'order-app',
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
  console.log(' [Order Service] is listening on NATS');
}
void bootstrap();
