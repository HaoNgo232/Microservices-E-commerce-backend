import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReportService } from '@report-app/report/report.service';
import { EVENTS } from '@shared/events';
import { SalesSummaryDto, ProductPerformanceDto, UserCohortDto } from '@shared/dto/report.dto';
import { ProductPerformanceResponse, SalesSummaryResponse, UserCohortResponse } from '@shared/types';

/**
 * ReportController - NATS Message Handler cho Reports
 *
 * Xử lý các NATS messages liên quan đến báo cáo:
 * - SALES_SUMMARY: Tổng hợp doanh thu theo khoảng thời gian
 * - PRODUCT_PERF: Hiệu suất bán hàng của sản phẩm
 * - USER_COHORT: Phân tích người dùng (mới, active, returning)
 *
 * **Note:** Controller chỉ route messages, business logic ở ReportService
 */
@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * NATS Handler: Tạo báo cáo tổng hợp doanh thu
   *
   * Pattern: report.salesSummary
   * @param dto - Khoảng thời gian báo cáo (fromAt, toAt)
   * @returns Tổng số đơn, doanh thu, giá trị đơn hàng trung bình
   */
  @MessagePattern(EVENTS.REPORT.SALES_SUMMARY)
  salesSummary(@Payload() dto: SalesSummaryDto): Promise<SalesSummaryResponse> {
    return this.reportService.salesSummary(dto);
  }

  /**
   * NATS Handler: Tạo báo cáo hiệu suất sản phẩm
   *
   * Pattern: report.productPerformance
   * @param dto - Khoảng thời gian báo cáo (fromAt, toAt)
   * @returns Danh sách sản phẩm bán chạy với số lượng và doanh thu
   */
  @MessagePattern(EVENTS.REPORT.PRODUCT_PERF)
  productPerformance(@Payload() dto: ProductPerformanceDto): Promise<ProductPerformanceResponse> {
    return this.reportService.productPerformance(dto);
  }

  /**
   * NATS Handler: Tạo báo cáo phân tích người dùng
   *
   * Pattern: report.userCohort
   * @param dto - Khoảng thời gian báo cáo (fromAt, toAt)
   * @returns Số người dùng mới, active, và returning customers
   */
  @MessagePattern(EVENTS.REPORT.USER_COHORT)
  userCohort(@Payload() dto: UserCohortDto): Promise<UserCohortResponse> {
    return this.reportService.userCohort(dto);
  }
}
