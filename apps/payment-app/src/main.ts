import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { PaymentAppModule } from '@payment-app/payment-app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Bootstrap Payment Microservice
 *
 * Khởi tạo và cấu hình Payment microservice với:
 * - NATS transport để giao tiếp với các service khác
 * - Global validation pipe để validate DTO
 * - Global exception filter để xử lý lỗi RPC
 * - Queue-based message handling
 *
 * **Business Domain:**
 * - Payment processing (COD, SePay)
 * - Payment verification
 * - Transaction tracking từ SePay webhook
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
