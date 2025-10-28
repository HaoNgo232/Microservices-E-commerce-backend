import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/client';

/**
 * PrismaService - Quản lý kết nối database cho User Service
 *
 * Service này kế thừa PrismaClient và tự động kết nối database
 * khi module được khởi tạo. Database riêng biệt cho User domain.
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
