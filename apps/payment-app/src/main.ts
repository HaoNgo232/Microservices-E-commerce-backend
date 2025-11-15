import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { PaymentAppModule } from '@payment-app/payment-app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Khởi động Payment Microservice
 *
 * Thiết lập và cấu hình microservice xử lý thanh toán bao gồm:
 * - Kết nối NATS để trao đổi dữ liệu với các service khác
 * - Validation tự động cho tất cả dữ liệu đầu vào
 * - Xử lý lỗi tập trung cho RPC calls
 * - Hàng đợi tin nhắn để xử lý song song
 *
 * **Chức năng chính:**
 * - Xử lý thanh toán (COD, SePay)
 * - Xác minh thanh toán
 * - Theo dõi giao dịch từ webhook SePay
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(PaymentAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'payment-app',
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
  console.log(' [Payment Service] is listening on NATS');
}
void bootstrap();
