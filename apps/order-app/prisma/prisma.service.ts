import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/client';

/**
 * PrismaService - Quản lý kết nối database cho Order Service
 *
 * Service này kế thừa PrismaClient và tự động kết nối database
 * khi module được khởi tạo. Database riêng biệt cho Order domain.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /**
   * Khởi tạo kết nối database khi module được load
   * Được gọi tự động bởi NestJS lifecycle
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
