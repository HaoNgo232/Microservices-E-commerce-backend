import { NestFactory } from '@nestjs/core';
import { ArAppModule } from '@ar-app/ar-app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

/**
 * Khởi động AR Microservice
 *
 * Thiết lập và cấu hình microservice thực tế ảo bao gồm:
 * - Kết nối NATS để trao đổi dữ liệu với các service khác
 * - Validation tự động cho tất cả dữ liệu đầu vào
 * - Xử lý lỗi tập trung cho RPC calls
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
