import { NestFactory } from '@nestjs/core';
import { AppModule } from '@gateway/app.module';
import { ValidationPipe } from '@nestjs/common';

/**
 * Bootstrap API Gateway Application
 *
 * Khởi tạo và cấu hình API Gateway với:
 * - Global validation pipe để validate DTOs
 * - CORS configuration cho cross-origin requests
 * - HTTP server listening trên port được cấu hình
 *
 * **Security Features:**
 * - Request validation với class-validator
 * - CORS whitelist configuration
 * - Rate limiting và audit logging (via middleware)
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Convert types automatically
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(` [Gateway] is running on http://localhost:${port}`);
}

void bootstrap();
