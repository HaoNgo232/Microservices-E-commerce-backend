---
phase: requirements
title: Report Analytics - Real Database Implementation
description: Triển khai logic báo cáo và phân tích với database thật thay vì mock data
feature: report-analytics
status: planning
created: 2025-01-28
---

# Requirements: Report Analytics Service

## Problem Statement

**Vấn đề cốt lõi:**

Report Service hiện tại đang sử dụng **mock data** thay vì query dữ liệu thực từ database và các microservices khác. Điều này dẫn đến:

- Admin/Manager không có dữ liệu thực để ra quyết định kinh doanh
- Báo cáo không phản ánh tình trạng thực tế của hệ thống
- Không thể sử dụng trong production environment
- Mock data cố định không test được edge cases (no orders, empty periods, etc.)

**Người dùng bị ảnh hưởng:**

- **Admin/Business Manager**: Cần insights thực về doanh thu, sản phẩm, người dùng
- **System Administrators**: Cần monitoring và analytics chính xác
- **Stakeholders**: Cần báo cáo định kỳ để đánh giá hiệu suất kinh doanh

**Tình trạng hiện tại:**

```typescript
// ❌ HIỆN TẠI - Mock data cố định
const mockData = {
  fromAt,
  toAt,
  totalOrders: 150, // Hard-coded
  totalRevenueInt: 45000000,
  averageOrderValueInt: 300000,
};
```

## Goals & Objectives

### Primary Goals

1. **Thay thế mock data bằng queries thực** từ Order, User, và Product services
2. **Tạo NATS events mới** để hỗ trợ reporting queries
3. **Implement aggregation logic** chính xác cho các metrics
4. **Đảm bảo performance** cho date ranges lớn (lên đến 1 năm)

### Secondary Goals

- Tối ưu số lượng NATS calls (batch queries khi có thể)
- Log và monitor report generation performance
- Caching strategy cho frequently requested reports (future enhancement)

### Non-Goals

- ❌ Real-time streaming analytics (out of scope)
- ❌ Custom report builder UI (chỉ focus backend API)
- ❌ Export reports to PDF/Excel (future feature)
- ❌ Historical data migration (sẽ seed data mới)
- ❌ Advanced analytics (ML/AI predictions)

## User Stories & Use Cases

### Story 1: Sales Summary Report

```gherkin
As an Admin
I want to xem tổng hợp doanh thu trong khoảng thời gian cụ thể
So that tôi có thể đánh giá hiệu suất kinh doanh và xu hướng doanh thu

Given tôi là Admin đã authenticated
When tôi request sales summary từ 2024-01-01 đến 2024-12-31
Then hệ thống query tất cả orders trong period
And tính tổng số orders (không bao gồm CANCELLED)
And tính tổng doanh thu (sum of order.totalInt)
And tính giá trị đơn hàng trung bình (AVG)
And return kết quả với timestamps chính xác
```

**Acceptance Criteria:**

- ✅ Input validation: fromAt phải là valid ISO date string
- ✅ Input validation: toAt phải là valid ISO date string
- ✅ Input validation: fromAt < toAt
- ✅ Query orders với status != 'CANCELLED'
- ✅ Tính toán chính xác: totalOrders, totalRevenueInt, averageOrderValueInt
- ✅ Lưu ReportEntry vào database
- ✅ Return response trong < 5 seconds
- ✅ Handle edge case: Không có orders trong period → return zeros

**Critical Flow:**

1. Gateway nhận HTTP request với JWT
2. Gateway forward qua NATS → Report Service
3. Report Service validate date range
4. Report Service call Order Service qua NATS: `order.getStatsByDateRange`
5. Order Service query database và aggregate
6. Report Service lưu ReportEntry
7. Return aggregated data về Gateway → Client

### Story 2: Product Performance Report

```gherkin
As an Admin
I want to xem sản phẩm nào bán chạy nhất trong khoảng thời gian
So that tôi có thể tối ưu inventory, pricing, và marketing campaigns

Given tôi là Admin
When tôi request product performance report
Then hệ thống query tất cả OrderItems trong period
And aggregate theo productId (SUM quantity, SUM revenue)
And fetch product names từ Product Service
And sắp xếp theo totalRevenueInt DESC
And return top products với metrics
```

**Acceptance Criteria:**

- ✅ Query OrderItems joined với Orders (filter by order.createdAt)
- ✅ Exclude OrderItems từ CANCELLED orders
- ✅ Group by productId
- ✅ Calculate totalQuantitySold = SUM(quantity)
- ✅ Calculate totalRevenueInt = SUM(priceInt \* quantity)
- ✅ Batch query Product Service để get product names (dùng EVENTS.PRODUCT.GET_BY_IDS)
- ✅ Sort by revenue DESC (top sellers first)
- ✅ Handle edge case: Product đã bị xóa → skip hoặc show "Unknown Product"

**Critical Flow:**

1. Report Service call Order Service: `orderItem.listByDateRange`
2. Order Service return array of OrderItems với productId, quantity, priceInt
3. Report Service aggregate locally (Map<productId, stats>)
4. Report Service batch call Product Service: `product.getByIds`
5. Product Service return product details
6. Report Service merge data và return sorted list

### Story 3: User Cohort Analysis

```gherkin
As an Admin
I want to xem metrics về người dùng (mới, active, returning customers)
So that tôi có thể đánh giá user retention và growth

Given tôi là Admin
When tôi request user cohort report cho Q1 2024
Then hệ thống tính:
  - newUsers: Users created trong period
  - activeUsers: Users có ít nhất 1 order trong period
  - returningCustomers: Users có >1 order trong period
```

**Acceptance Criteria:**

- ✅ Query User Service: count users created between fromAt-toAt
- ✅ Query Order Service: distinct userIds trong period
- ✅ Query Order Service: userIds với count(orders) > 1
- ✅ Return 3 metrics: newUsers, activeUsers, returningCustomers
- ✅ Handle edge case: Không có users → return zeros

**Definitions:**

- **newUsers**: `COUNT(users WHERE createdAt BETWEEN fromAt AND toAt)`
- **activeUsers**: `COUNT(DISTINCT userId FROM orders WHERE createdAt BETWEEN fromAt AND toAt AND status != 'CANCELLED')`
- **returningCustomers**: `COUNT(userId FROM orders WHERE createdAt BETWEEN fromAt AND toAt GROUP BY userId HAVING COUNT(*) > 1)`

**Critical Flow:**

1. Report Service call User Service: `user.countByDateRange`
2. Report Service call Order Service: `order.getUserCohortStats`
3. Order Service aggregate và return metrics
4. Report Service combine và return

### Edge Cases

**Date Range Edge Cases:**

- Empty period (no orders, no users) → Return zeros, not error
- Single day period → Works correctly
- Future dates → Return zeros (no future data)
- Very large range (>1 year) → Log warning, but still process

**Data Integrity Edge Cases:**

- Product đã bị soft-delete → Show "Product Not Found" hoặc skip
- Order cancelled sau khi report generated → Stale data (acceptable)
- User deactivated → Still count in historical reports

**Performance Edge Cases:**

- 10,000+ orders trong period → Should complete in <10s
- 1,000+ unique products → Batch query efficiently
- NATS timeout → Retry once, then fail gracefully

## Success Criteria

### Functional Requirements

**Must Have:**

- [ ] Query thực từ Order Service (thay mock data)
- [ ] Query thực từ User Service
- [ ] Query thực từ Product Service (cho product names)
- [ ] Aggregation logic chính xác (SUM, COUNT, AVG, GROUP BY)
- [ ] Handle edge cases (empty periods, deleted products)
- [ ] Input validation (date format, range validation)
- [ ] Error handling với RPC exceptions
- [ ] Lưu ReportEntry metadata vào database

**Should Have:**

- [ ] Batch queries để giảm NATS calls
- [ ] Performance logging (track generation time)
- [ ] Unit tests coverage ≥80%
- [ ] E2E tests với seeded data

**Nice to Have:**

- [ ] Cache frequent reports (1 hour TTL)
- [ ] Pagination cho product performance (top 100)
- [ ] Additional metrics (median order value, etc.)

### Performance Benchmarks

| Metric                             | Target | Max Acceptable |
| ---------------------------------- | ------ | -------------- |
| Sales Summary                      | < 2s   | < 5s           |
| Product Performance (100 products) | < 3s   | < 5s           |
| User Cohort                        | < 2s   | < 5s           |
| NATS call timeout                  | 5000ms | 10000ms        |
| Max date range                     | 1 year | 2 years        |

### Acceptance Tests

```typescript
// E2E Test Example
describe('Sales Summary - Real Data', () => {
  beforeEach(async () => {
    await seedOrders([
      { userId: 'u1', totalInt: 100000, createdAt: '2024-06-15', status: 'PAID' },
      { userId: 'u2', totalInt: 200000, createdAt: '2024-06-20', status: 'PAID' },
      { userId: 'u3', totalInt: 150000, createdAt: '2024-06-25', status: 'CANCELLED' }, // excluded
    ]);
  });

  it('should return correct sales summary', async () => {
    const result = await client.send(EVENTS.REPORT.SALES_SUMMARY, {
      fromAt: '2024-06-01T00:00:00Z',
      toAt: '2024-06-30T23:59:59Z',
    });

    expect(result.totalOrders).toBe(2); // Cancelled excluded
    expect(result.totalRevenueInt).toBe(300000);
    expect(result.averageOrderValueInt).toBe(150000);
  });
});
```

## Constraints & Assumptions

### Technical Constraints

**Architecture:**

- ✅ Microservices: KHÔNG được truy cập trực tiếp database của Order/User/Product
- ✅ Phải dùng NATS message queue cho inter-service communication
- ✅ Mỗi service có database riêng biệt (database-per-service pattern)
- ✅ Report Service chỉ có quyền đọc (read-only), không modify data

**NATS Communication:**

```typescript
// ✅ BẮT BUỘC: Timeout và retry
firstValueFrom(
  this.orderClient.send(event, payload).pipe(timeout(5000), retry({ count: 1, delay: 1000 })),
);
```

**Database:**

- Report Service DB: Chỉ lưu ReportEntry (metadata)
- Không cache aggregated results trong DB (chỉ cache in-memory nếu cần)

### Business Constraints

- Reports chỉ available cho ADMIN role
- Historical data: Chỉ từ thời điểm deploy feature này (no backfill)
- Timezone: UTC (clients handle conversion)

### Assumptions

1. **Order Service có đủ data**: Orders và OrderItems đã được populate
2. **Product data stable**: Products không bị xóa thường xuyên
3. **User data stable**: UserIds trong orders vẫn valid
4. **NATS available**: Message broker uptime ≥99.9%
5. **Date ranges hợp lý**: Users không query 10+ years data

### Dependencies

**Microservices:**

- ✅ Order Service: Cần implement events mới
  - `order.getStatsByDateRange` (NEW)
  - `orderItem.listByDateRange` (NEW)
  - `order.getUserCohortStats` (NEW)

- ✅ User Service: Cần implement event mới
  - `user.countByDateRange` (NEW)

- ✅ Product Service: Đã có event
  - `product.getByIds` (EXISTS ✅)

**External Libraries:**

- RxJS: firstValueFrom, timeout, retry
- Prisma: Query builder
- class-validator: DTO validation

## Questions & Open Items

### Unresolved Questions

**Q1: Order Service Events - Ai implement?**

- [ ] Tạo DTOs mới: `OrderStatsByDateRangeDto`, `OrderItemsByDateRangeDto`
- [ ] Implement methods trong OrdersService
- [ ] Add @MessagePattern handlers trong OrdersController
- [ ] Write unit tests
- **Decision needed:** Làm trong cùng PR hay tách riêng?

**Q2: User Cohort Definitions - Confirm với stakeholders?**

- "Active users" = users có ít nhất 1 order? Hay login activity?
- "Returning customers" = >1 order trong period? Hay lifetime?
- **Decision needed:** Cần clarify business definitions

**Q3: Product Performance - Top N hay tất cả?**

- Return ALL products (có thể hàng ngàn)?
- Hay limit top 100 best sellers?
- **Decision needed:** Pagination strategy

**Q4: Report Storage Strategy?**

- Có cache reports trong database không?
- ReportEntry hiện tại chỉ lưu metadata, có cần lưu full result?
- **Decision needed:** Cache vs recalculate

**Q5: Timezone Handling?**

- Input dates assume UTC?
- Có support timezone parameter không?
- **Decision needed:** UTC only hoặc support timezones

### Items Requiring Stakeholder Input

1. **Performance vs Accuracy Trade-off:**
   - Với date range lớn (1 năm), có chấp nhận sampling không?
   - Hoặc run as background job?

2. **Report Retention:**
   - ReportEntry records lưu bao lâu? (30 days? 1 year?)
   - Auto-cleanup strategy?

3. **Additional Metrics:**
   - Sales summary: Có cần breakdown by month/week không?
   - Product performance: Có cần category breakdown?
   - User cohort: Có cần geographic breakdown?

### Research Needed

- [ ] **Performance testing:** Benchmark với 100K orders
- [ ] **NATS optimization:** Batch vs individual calls performance
- [ ] **Aggregation pipeline:** Database-side vs application-side aggregation
- [ ] **Caching strategy:** Redis vs in-memory vs database

### Code Cleanup Required

**Trước khi implement:**

```typescript:261:290:apps/report-app/src/report/report.service.ts
// ❌ XÓA: Code thừa copy-paste từ PaymentService
private mapToPaymentResponse(payment: {
  id: string;
  orderId: string;
  method: string;
  // ...
}): { ... } {
  // This method doesn't belong in ReportService!
}
```

**Fix types location:**

```typescript
// ❌ SAI: Report types đang ở ar.types.ts
// libs/shared/types/ar.types.ts lines 41-72

// ✅ ĐÚNG: Tạo file riêng
// libs/shared/types/report.types.ts
```

## Implementation Plan (High-Level)

### Phase 1: Preparation (Week 1)

1. ✅ Create requirements document (this file)
2. Clean up existing code
   - Delete `mapToPaymentResponse` method
   - Move types từ ar.types.ts → report.types.ts
3. Create design document
4. Review với team

### Phase 2: Order Service Integration (Week 2)

1. Create DTOs trong libs/shared/dto/
2. Add events to libs/shared/events.ts
3. Implement OrdersService methods
4. Add OrdersController handlers
5. Write unit tests
6. Write E2E tests

### Phase 3: Report Service Implementation (Week 3)

1. Implement salesSummary với real queries
2. Implement productPerformance với real queries
3. Implement userCohort với real queries
4. Update unit tests (mock NATS responses)
5. Update E2E tests (with seeded data)

### Phase 4: Testing & Optimization (Week 4)

1. Seed test data (scripts/seed-reports-data.ts)
2. Performance testing
3. Fix issues
4. Documentation
5. Deploy to staging

## Related Documents

- **Design:** `docs/ai/design/feature-report-analytics.md` (to be created)
- **Implementation:** `docs/ai/implementation/feature-report-analytics.md` (to be created)
- **Testing:** `docs/ai/testing/feature-report-analytics.md` (to be created)
- **Architecture:** `docs/AI-ASSISTANT-GUIDE.md` (existing)
- **RPC Patterns:** `docs/testing/RPC-EXCEPTIONS-GUIDE.md` (existing)

## Acceptance Checklist

Trước khi đánh dấu feature này là DONE:

- [ ] All mock data replaced với real queries
- [ ] All 3 report types working correctly
- [ ] Unit tests ≥80% coverage
- [ ] E2E tests passing với seeded data
- [ ] Performance benchmarks met
- [ ] Code cleanup complete (no dead code)
- [ ] Types properly organized
- [ ] Documentation updated
- [ ] HTTP test file updated với real examples
- [ ] Reviewed by team lead

---

**Document Status:** ✅ COMPLETE - Ready for Design Phase

**Next Steps:**

1. Review requirements với team
2. Create design document
3. Begin implementation Phase 1
