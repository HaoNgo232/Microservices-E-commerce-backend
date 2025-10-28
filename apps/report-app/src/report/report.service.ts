import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SalesSummaryDto, ProductPerformanceDto, UserCohortDto } from '@shared/dto/report.dto';
import { PrismaService } from '@report-app/prisma/prisma.service';
import { ValidationRpcException } from '@shared/exceptions/rpc-exceptions';
import {
  ProductPerformanceResponse,
  SalesSummaryResponse,
  UserCohortResponse,
} from '@shared/types';

/** Interface cho Report Service
 * Định nghĩa các phương thức tạo báo cáo
 */
export interface IReportService {
  /**
   * Tạo báo cáo tổng hợp doanh thu
   */
  salesSummary(dto: SalesSummaryDto): Promise<SalesSummaryResponse>;

  /**
   * Tạo báo cáo hiệu suất sản phẩm
   */
  productPerformance(dto: ProductPerformanceDto): Promise<ProductPerformanceResponse>;

  /**
   * Tạo báo cáo phân tích người dùng
   */
  userCohort(dto: UserCohortDto): Promise<UserCohortResponse>;
}

/**
 * ReportService - Service xử lý báo cáo và phân tích
 *
 * Xử lý business logic liên quan đến:
 * - Báo cáo tổng hợp doanh thu (sales summary)
 * - Báo cáo hiệu suất sản phẩm (product performance)
 * - Phân tích người dùng (user cohort analysis)
 *
 * **Tích hợp microservices:**
 * - Order Service: Lấy dữ liệu đơn hàng để phân tích
 * - User Service: Lấy dữ liệu người dùng để phân tích
 *
 * **Note:** Implementation hiện tại sử dụng mock data
 * Production cần query thực tế từ Order và User services
 */
@Injectable()
export class ReportService implements IReportService {
  /**
   * Constructor - Inject dependencies
   *
   * @param prisma - Prisma client để lưu report entries
   * @param orderClient - NATS client gọi Order Service
   * @param userClient - NATS client gọi User Service
   */
  constructor(
    private readonly prisma: PrismaService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  /**
   * Tạo báo cáo tổng hợp doanh thu
   *
   * Tổng hợp dữ liệu đơn hàng trong khoảng thời gian:
   * - Tổng số đơn hàng
   * - Tổng doanh thu
   * - Giá trị đơn hàng trung bình
   *
   * @param dto - Khoảng thời gian báo cáo (fromAt, toAt)
   * @returns Báo cáo tổng hợp doanh thu
   * @throws ValidationRpcException nếu fromAt > toAt
   */
  async salesSummary(dto: SalesSummaryDto): Promise<SalesSummaryResponse> {
    try {
      const fromAt = new Date(dto.fromAt);
      const toAt = new Date(dto.toAt);

      // Validate date range
      if (fromAt > toAt) {
        throw new ValidationRpcException('fromAt must be before toAt');
      }

      // In production, this would query actual order data
      // For now, return mock aggregated data
      const mockData = {
        fromAt,
        toAt,
        totalOrders: 150,
        totalRevenueInt: 45000000, // 450,000 VND in cents
        averageOrderValueInt: 300000, // 3,000 VND in cents
      };

      // Store report entry
      await this.prisma.reportEntry.create({
        data: {
          type: 'SALES_SUMMARY',
          payload: mockData as never,
          fromAt,
          toAt,
        },
      });

      console.log(
        `[ReportService] Generated sales summary: ${fromAt.toISOString()} to ${toAt.toISOString()}`,
      );
      return mockData;
    } catch (error) {
      if (error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[ReportService] salesSummary error:', {
        fromAt: dto.fromAt,
        toAt: dto.toAt,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ValidationRpcException('Failed to generate sales summary');
    }
  }

  /**
   * Tạo báo cáo hiệu suất sản phẩm
   *
   * Hiển thị các sản phẩm bán chạy nhất trong khoảng thời gian:
   * - Tên sản phẩm
   * - Tổng số lượng đã bán
   * - Tổng doanh thu từ sản phẩm
   *
   * @param dto - Khoảng thời gian báo cáo (fromAt, toAt)
   * @returns Danh sách sản phẩm với metrics
   * @throws ValidationRpcException nếu fromAt > toAt
   */
  async productPerformance(dto: ProductPerformanceDto): Promise<ProductPerformanceResponse> {
    try {
      const fromAt = new Date(dto.fromAt);
      const toAt = new Date(dto.toAt);

      if (fromAt > toAt) {
        throw new ValidationRpcException('fromAt must be before toAt');
      }

      // Mock product performance data
      const mockData = {
        fromAt,
        toAt,
        products: [
          {
            productId: 'prod-1',
            productName: 'Product A',
            totalQuantitySold: 50,
            totalRevenueInt: 10000000,
          },
          {
            productId: 'prod-2',
            productName: 'Product B',
            totalQuantitySold: 30,
            totalRevenueInt: 6000000,
          },
        ],
      };

      await this.prisma.reportEntry.create({
        data: {
          type: 'PRODUCT_PERFORMANCE',
          payload: mockData as never,
          fromAt,
          toAt,
        },
      });

      console.log(
        `[ReportService] Generated product performance: ${fromAt.toISOString()} to ${toAt.toISOString()}`,
      );
      return mockData;
    } catch (error) {
      if (error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[ReportService] productPerformance error:', {
        fromAt: dto.fromAt,
        toAt: dto.toAt,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ValidationRpcException('Failed to generate product performance report');
    }
  }

  /**
   * Tạo báo cáo phân tích người dùng
   *
   * Hiển thị metrics về người dùng trong khoảng thời gian:
   * - Số người dùng mới đăng ký
   * - Số người dùng active
   * - Số khách hàng quay lại mua hàng (returning customers)
   *
   * @param dto - Khoảng thời gian báo cáo (fromAt, toAt)
   * @returns Metrics về người dùng
   * @throws ValidationRpcException nếu fromAt > toAt
   */
  async userCohort(dto: UserCohortDto): Promise<UserCohortResponse> {
    try {
      const fromAt = new Date(dto.fromAt);
      const toAt = new Date(dto.toAt);

      if (fromAt > toAt) {
        throw new ValidationRpcException('fromAt must be before toAt');
      }

      // Mock user cohort data
      const mockData = {
        fromAt,
        toAt,
        newUsers: 25,
        activeUsers: 120,
        returningCustomers: 80,
      };

      await this.prisma.reportEntry.create({
        data: {
          type: 'USER_COHORT',
          payload: mockData as never,
          fromAt,
          toAt,
        },
      });

      console.log(
        `[ReportService] Generated user cohort: ${fromAt.toISOString()} to ${toAt.toISOString()}`,
      );
      return mockData;
    } catch (error) {
      if (error instanceof ValidationRpcException) {
        throw error;
      }

      console.error('[ReportService] userCohort error:', {
        fromAt: dto.fromAt,
        toAt: dto.toAt,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new ValidationRpcException('Failed to generate user cohort report');
    }
  }

  /**
   * Chuyển đổi dữ liệu payment từ Prisma sang PaymentResponse DTO
   *
   * **Lưu ý:** Method này có vẻ không thuộc về ReportService
   * Có thể là code bị copy-paste nhầm từ PaymentService
   * Cần xem xét di chuyển hoặc xóa bỏ method này
   *
   * @param payment - Đối tượng Payment từ Prisma database
   * @returns Đối tượng PaymentResponse DTO đã được format
   * @private
   */
  private mapToPaymentResponse(payment: {
    id: string;
    orderId: string;
    method: string;
    amountInt: number;
    status: string;
    payload: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): {
    id: string;
    orderId: string;
    method: string;
    amountInt: number;
    status: string;
    payload: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      amountInt: payment.amountInt,
      status: payment.status,
      payload: payment.payload as Record<string, unknown> | null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
