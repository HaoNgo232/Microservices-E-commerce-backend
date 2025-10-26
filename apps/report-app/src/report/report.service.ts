import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SalesSummaryDto, ProductPerformanceDto, UserCohortDto } from '@shared/dto/report.dto';
import { PrismaService } from '@report-app/prisma/prisma.service';
import { ValidationRpcException } from '@shared/exceptions/rpc-exceptions';

/**
 * Sales summary report response
 */
type SalesSummaryResponse = {
  fromAt: Date;
  toAt: Date;
  totalOrders: number;
  totalRevenueInt: number;
  averageOrderValueInt: number;
};

/**
 * Product performance report response
 */
type ProductPerformanceResponse = {
  fromAt: Date;
  toAt: Date;
  products: Array<{
    productId: string;
    productName: string;
    totalQuantitySold: number;
    totalRevenueInt: number;
  }>;
};

/**
 * User cohort report response
 */
type UserCohortResponse = {
  fromAt: Date;
  toAt: Date;
  newUsers: number;
  activeUsers: number;
  returningCustomers: number;
};

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  /**
   * Generate sales summary report
   * Aggregates order data within date range
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
   * Generate product performance report
   * Shows best-selling products within date range
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
   * Generate user cohort report
   * Shows user growth and retention metrics
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
   * Map Prisma payment to PaymentResponse
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
