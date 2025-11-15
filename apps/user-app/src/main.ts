import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { UserAppModule } from '@user-app/user-app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Khởi động User Microservice
 *
 * Thiết lập và cấu hình microservice quản lý user bao gồm:
 * - Kết nối NATS để trao đổi dữ liệu với các service khác
 * - Validation tự động cho tất cả dữ liệu đầu vào
 * - Xử lý lỗi tập trung cho RPC calls
 * - Hàng đợi tin nhắn để xử lý song song
 *
 * **Chức năng chính:**
 * - Quản lý thông tin user (tạo, sửa, xóa, tìm kiếm)
 * - Xác thực người dùng (đăng nhập, đăng ký, JWT)
 * - Quản lý địa chỉ giao hàng
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(UserAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'user-app',
    },
  });

  // Validation tự động cho tất cả dữ liệu đầu vào
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

  // Xử lý lỗi tập trung cho RPC
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
  console.log(' [User Service] is listening on NATS');
}
void bootstrap();
