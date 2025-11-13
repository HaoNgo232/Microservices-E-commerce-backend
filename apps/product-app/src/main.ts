import { NestFactory } from '@nestjs/core';
import { ProductAppModule } from '@product-app/product-app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Bootstrap Product Microservice
 *
 * Khởi tạo và cấu hình Product microservice với:
 * - NATS transport để giao tiếp với các service khác
 * - Global validation pipe để validate DTO
 * - Global exception filter để xử lý lỗi RPC
 * - Queue-based message handling
 *
 * **Business Domain:**
 * - Product management (CRUD)
 * - Category management (hierarchical structure)
 * - Stock management
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(ProductAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'product-app',
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
  console.log(' [Product Service] is listening on NATS');
}
void bootstrap();
