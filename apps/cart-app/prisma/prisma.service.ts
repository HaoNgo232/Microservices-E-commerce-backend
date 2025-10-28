import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/client';

/**
 * PrismaService - Quản lý kết nối database cho Cart Service
 *
 * Service này kế thừa PrismaClient và tự động kết nối database
 * khi module được khởi tạo.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  /**
   * Khởi tạo kết nối database khi module được load
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
