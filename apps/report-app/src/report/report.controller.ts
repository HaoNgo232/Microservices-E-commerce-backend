import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ReportService } from '@report-app/report/report.service';
import { EVENTS } from '@shared/events';
import { SalesSummaryDto, ProductPerformanceDto, UserCohortDto } from '@shared/dto/report.dto';
import {
  ProductPerformanceResponse,
  SalesSummaryResponse,
  UserCohortResponse,
} from '@shared/types';

@Controller()
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @MessagePattern(EVENTS.REPORT.SALES_SUMMARY)
  salesSummary(@Payload() dto: SalesSummaryDto): Promise<SalesSummaryResponse> {
    return this.reportService.salesSummary(dto);
  }

  @MessagePattern(EVENTS.REPORT.PRODUCT_PERF)
  productPerformance(@Payload() dto: ProductPerformanceDto): Promise<ProductPerformanceResponse> {
    return this.reportService.productPerformance(dto);
  }

  @MessagePattern(EVENTS.REPORT.USER_COHORT)
  userCohort(@Payload() dto: UserCohortDto): Promise<UserCohortResponse> {
    return this.reportService.userCohort(dto);
  }
}
