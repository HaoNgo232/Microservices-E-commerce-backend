---
phase: requirements
title: VIP Customer Management & Promotions - Requirements
description: Khách hàng VIP với mã giảm giá, phân loại tự động, và quản lý admin
---

# Requirements & Problem Understanding

## Problem Statement

**What problem are we solving?**

- **Vấn đề**: Hiện tại hệ thống không có cơ chế phân biệt khách hàng theo giá trị chi tiêu, dẫn đến không có ưu đãi đặc biệt cho khách hàng thân thiết
- **Ai bị ảnh hưởng**:
  - Khách hàng trung thành không được công nhận và ưu đãi
  - Admin không có công cụ để chăm sóc khách hàng VIP
  - Doanh nghiệp mất cơ hội tăng retention và lifetime value
- **Tình trạng hiện tại**: Tất cả khách hàng được đối xử như nhau, không có phân tầng giá trị

## Goals & Objectives

**What do we want to achieve?**

### Primary Goals

1. **Tự động phân loại khách hàng VIP** dựa trên tổng chi tiêu
2. **Áp dụng mã giảm giá tự động** cho khách hàng VIP
3. **Admin có thể quản lý** VIP tier và mã giảm giá
4. **Tăng retention rate** bằng ưu đãi có giá trị

### Secondary Goals

- Hiển thị badge VIP trên profile khách hàng
- Thống kê hiệu quả chương trình VIP
- Email thông báo khi lên/xuống tier

### Non-goals (Out of Scope - Phase 1)

- Chương trình điểm thưởng (loyalty points)
- Mã giảm giá dựa trên sản phẩm cụ thể
- VIP tier tự động expire sau thời gian
- Referral program cho VIP

## User Stories & Use Cases

### User Story 1: Khách hàng được tự động nâng cấp VIP

**As a** customer  
**I want to** automatically become VIP when I spend enough  
**So that** I can get discounts on future purchases

**Acceptance Criteria**:

- ✓ Khi tổng chi tiêu đạt ngưỡng Bronze (5,000,000 VND), tự động lên Bronze
- ✓ Hiển thị badge VIP trên profile
- ✓ Nhận email thông báo nâng cấp
- ✓ Mã giảm giá Bronze tự động áp dụng trong cart

### User Story 2: Admin tạo và quản lý mã giảm giá VIP

**As an** admin  
**I want to** create discount codes for each VIP tier  
**So that** I can offer targeted promotions

**Acceptance Criteria**:

- ✓ Tạo mã giảm giá theo % hoặc số tiền cố định
- ✓ Giới hạn mã cho tier cụ thể (Bronze/Silver/Gold/Platinum)
- ✓ Đặt ngày hết hạn và số lần sử dụng tối đa
- ✓ Vô hiệu hóa/kích hoạt mã bất kỳ lúc nào

### User Story 3: Admin thủ công điều chỉnh tier của khách hàng

**As an** admin  
**I want to** manually upgrade/downgrade customer tiers  
**So that** I can reward special customers or handle exceptions

**Acceptance Criteria**:

- ✓ Chọn khách hàng và thay đổi tier
- ✓ Ghi log lý do thay đổi
- ✓ Khách hàng nhận thông báo về thay đổi
- ✓ Tier thủ công không bị ghi đè bởi tự động

### User Story 4: Khách hàng áp dụng mã giảm giá trong checkout

**As a** VIP customer  
**I want to** apply discount codes during checkout  
**So that** I can get reduced prices

**Acceptance Criteria**:

- ✓ Input field để nhập mã giảm giá
- ✓ Validate mã có hợp lệ cho tier hiện tại
- ✓ Hiển thị số tiền được giảm
- ✓ Mã được lưu trong order history

## Success Criteria

**How will we know when we're done?**

### Measurable Outcomes

1. **Adoption Rate**: 20% khách hàng đạt Bronze tier trong 3 tháng đầu
2. **Retention**: Tăng 15% repeat purchase rate cho VIP customers
3. **Revenue**: Tăng 10% average order value từ VIP segment
4. **Usage**: 60% VIP customers sử dụng mã giảm giá ít nhất 1 lần

### Technical Acceptance Criteria

- [ ] API endpoint để tính toán và cập nhật VIP tier
- [ ] CRUD endpoints cho discount codes
- [ ] Frontend UI để hiển thị VIP status
- [ ] Admin dashboard để quản lý VIP và discounts
- [ ] Email notifications cho tier changes
- [ ] Discount validation trong checkout flow
- [ ] Test coverage ≥ 90% cho VIP logic

### Performance Benchmarks

- Tính toán VIP tier < 100ms
- Áp dụng discount code < 50ms
- Admin dashboard load time < 1s

## Constraints & Assumptions

### Technical Constraints

- Backend: NestJS microservices, PostgreSQL database
- Frontend: Next.js 14 với TypeScript
- Phải tích hợp với Order Service hiện có
- JWT auth cho cả admin và customer

### Business Constraints

- Ngân sách: Không yêu cầu third-party service
- Timeline: MVP trong 2-3 tuần
- Team: 1 fullstack developer

### Assumptions

1. Tổng chi tiêu được tính từ orders với status `COMPLETED`
2. Discount codes có thể stack với promotions khác (phase 2)
3. Admin có thể override automatic tier assignments
4. VIP tier là **lifetime** (không expire tự động)

## VIP Tier Thresholds (Configurable)

| Tier     | Min Spending (VND) | Discount Rate |
| -------- | ------------------ | ------------- |
| Bronze   | 5,000,000          | 5%            |
| Silver   | 15,000,000         | 10%           |
| Gold     | 30,000,000         | 15%           |
| Platinum | 50,000,000         | 20%           |

## Questions & Open Items

### Unresolved Questions

1. **Q**: Có cần giới hạn số lần sử dụng mã giảm giá mỗi tháng?  
   **A**: Phase 1 - không giới hạn. Phase 2 - có thể thêm monthly cap

2. **Q**: Discount áp dụng cho shipping fee không?  
   **A**: Phase 1 - chỉ áp dụng cho subtotal (sản phẩm). Phase 2 - có thể mở rộng

3. **Q**: Admin có thể tạo mã giảm giá cho non-VIP không?  
   **A**: Có, có thể tạo mã cho `tier: null` (public codes)

4. **Q**: Xử lý như thế nào khi khách hàng có nhiều mã giảm giá?  
   **A**: Phase 1 - chỉ cho phép 1 mã/order. Phase 2 - stacking rules

### Items Requiring Stakeholder Input

- [ ] Xác nhận VIP tier thresholds
- [ ] Quyết định có gửi SMS notification không (ngoài email)
- [ ] Thiết kế badge VIP (logo/icon)

### Research Needed

- [ ] Best practices cho discount code validation
- [ ] Fraud prevention cho mã giảm giá
- [ ] Email template design cho tier notifications
