import { NestFactory } from '@nestjs/core';
import { AppModule } from '@gateway/app.module';
import { ValidationPipe } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from '@gateway/filters/http-exception.filter';

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

  // Enable exception filter để log errors chi tiết
  app.useGlobalFilters(new HttpExceptionFilter());

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
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://v0-eyewear-store-website-kohl.vercel.app', 'https://*.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  });

  // Disable caching để tránh race conditions và stale data
  app.use((req: Request, res: Response, next: () => void) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(` [Gateway] is running on http://localhost:${port}`);
}

void bootstrap();
