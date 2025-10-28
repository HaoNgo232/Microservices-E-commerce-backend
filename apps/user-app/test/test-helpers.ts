import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserAppModule } from '../src/user-app.module';
import { PrismaService } from '@user-app/prisma/prisma.service';

/**
 * Test Database Helper
 *
 * Cung cấp utilities cho E2E testing với test database:
 * - Setup test application
 * - Clean database giữa các tests
 * - Access Prisma service và app instance
 */
export class TestDatabaseHelper {
  private app: INestApplication;
  private prisma: PrismaService;

  /**
   * Setup test application
   *
   * @returns NestJS application instance
   */
  async setupTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UserAppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    this.prisma = this.app.get<PrismaService>(PrismaService);

    await this.app.init();
    return this.app;
  }

  /**
   * Clean database - Xóa tất cả test data
   *
   * Xóa theo thứ tự để tránh foreign key constraint:
   * 1. Address (foreign key to User)
   * 2. User
   */
  async cleanDatabase(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Prisma service not initialized. Call setupTestApp first.');
    }

    // Xóa data theo thứ tự để tránh foreign key constraint
    await this.prisma.address.deleteMany({});
    await this.prisma.user.deleteMany({});
  }

  /**
   * Đóng test application
   */
  async closeApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  /**
   * Lấy Prisma service instance
   */
  getPrisma(): PrismaService {
    return this.prisma;
  }

  /**
   * Lấy NestJS application instance
   */
  getApp(): INestApplication {
    return this.app;
  }
}

/**
 * Test Data Factory
 *
 * Tạo dữ liệu test có tính nhất quán với:
 * - Unique identifiers (timestamp-based)
 * - Default values hợp lệ
 * - Override support cho customization
 */
export class TestDataFactory {
  /**
   * Tạo dữ liệu user cho testing
   *
   * @param override - Override default values
   * @returns User data với email unique (timestamp-based)
   */
  static createUserData(
    override: Partial<{
      email: string;
      password: string;
      fullName: string;
      phone: string;
      role: string;
    }> = {},
  ): {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: string;
  } {
    return {
      email: `test-${Date.now()}@example.com`,
      password: 'Test@1234',
      fullName: 'Test User',
      phone: '0912345678',
      role: 'CUSTOMER',
      ...override,
    };
  }

  /**
   * Tạo dữ liệu address cho testing
   *
   * @param userId - ID của user sở hữu address
   * @param override - Override default values
   * @returns Address data với default values hợp lệ
   */
  static createAddressData(
    userId: string,
    override: Partial<{
      fullName: string;
      phone: string;
      province: string;
      district: string;
      ward: string;
      street: string;
      isDefault: boolean;
    }> = {},
  ): {
    userId: string;
    fullName: string;
    phone: string;
    province: string;
    district: string;
    ward: string;
    street: string;
    isDefault: boolean;
  } {
    return {
      userId,
      fullName: 'Test Recipient',
      phone: '0987654321',
      province: 'Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      street: '123 Nguyễn Huệ',
      isDefault: false,
      ...override,
    };
  }

  /**
   * Tạo dữ liệu login cho testing
   *
   * @param override - Override default values
   * @returns Login credentials
   */
  static createLoginData(
    override: Partial<{
      email: string;
      password: string;
    }> = {},
  ): {
    email: string;
    password: string;
  } {
    return {
      email: 'test@example.com',
      password: 'Test@1234',
      ...override,
    };
  }
}
