import { NestFactory } from '@nestjs/core';
import { ArAppModule } from '@ar-app/ar-app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Bootstrap AR Microservice
 *
 * Khởi tạo và cấu hình AR microservice với:
 * - NATS transport để giao tiếp với các service khác
 * - Global validation pipe để validate DTO
 * - Global exception filter để xử lý lỗi RPC
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(ArAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'ar-app',
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
  console.log(' [AR Service] is listening on NATS');
}
void bootstrap();
