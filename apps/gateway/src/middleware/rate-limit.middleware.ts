import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

/**
 * Rate Limiting Middleware
 * Part of Perimeter Security - prevent DDoS and brute force attacks
 *
 * Giới hạn số lượng requests từ mỗi IP trong 1 time window
 * Đây là implementation đơn giản cho thesis - production nên dùng Redis
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private store: RateLimitStore = {};
  private readonly maxRequests = 100; // requests per window
  private readonly windowMs = 60000; // 1 minute

  use(req: Request, res: Response, next: NextFunction): void {
    const key = this.getClientKey(req);
    const now = Date.now();

    // Reset counter nếu hết time window
    if (!this.store[key] || now > this.store[key].resetTime) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return next();
    }

    // Increment counter
    this.store[key].count++;

    // Check limit
    if (this.store[key].count > this.maxRequests) {
      throw new HttpException('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }

  /**
   * Lấy identifier của client (IP address)
   */
  private getClientKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
