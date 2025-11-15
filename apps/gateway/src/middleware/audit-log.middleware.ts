import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Audit Logging Middleware
 * Part of Perimeter Security - log all API access for security monitoring
 *
 * Log mọi requests đến API Gateway để tracking và phát hiện suspicious activity
 * Trong môi trường production nên gửi logs vào hệ thống logging tập trung (ELK, CloudWatch, v.v.)
 */
@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Log sau khi response đã gửi
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      // Log structured data (JSON) để dễ parse và analyze
      const user = req['user'] as { userId?: string } | undefined;
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          userId: user?.userId, // Từ AuthGuard nếu có
        }),
      );
    });

    next();
  }
}
