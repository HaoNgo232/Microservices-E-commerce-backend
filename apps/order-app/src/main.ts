import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { OrderAppModule } from '@order-app/order-app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Bootstrap Order Microservice
 *
 * Khởi tạo và cấu hình Order microservice với:
 * - NATS transport để giao tiếp với các service khác
 * - Global validation pipe để validate DTO
 * - Global exception filter để xử lý lỗi RPC
 * - Queue-based message handling
 *
 * **Business Domain:**
 * - Order management (create, update, cancel)
 * - Order items management
 * - Stock validation và integration với Product Service
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
  console.log('✅ [Order Service] is listening on NATS');
}
void bootstrap();
