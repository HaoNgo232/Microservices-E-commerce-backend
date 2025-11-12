---
phase: planning
title: VIP Customer Management & Promotions - Backend Planning
description: Task breakdown, timeline, và dependencies cho backend implementation
---

# Project Planning & Task Breakdown - Backend

## Milestones

- [x] **Milestone 1**: Requirements & Design Complete (Week 0)
- [ ] **Milestone 2**: Database & Core Services (Week 1)
  - User Service VIP tier logic
  - Promotion Service foundation
- [ ] **Milestone 3**: API Endpoints & Integration (Week 2)
  - Gateway routes
  - NATS event handlers
  - Order Service integration
- [ ] **Milestone 4**: Testing & Deployment (Week 3)
  - Unit tests (≥90% coverage)
  - Integration tests
  - Production deployment

## Task Breakdown

### Phase 1: Foundation & Database (Days 1-3)

#### Task 1.1: User Service - Database Migration
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Add VIP fields to User schema
  - `vipTier`, `vipTierOverride`, `totalSpentInt`, `tierUpdatedAt`, `tierReason`
- [ ] Create Prisma migration
- [ ] Run migration on dev database
- [ ] Seed test data with various VIP tiers

**Files**:
- `apps/user-app/prisma/schema.prisma`
- `apps/user-app/prisma/migrations/`

---

#### Task 1.2: Create Promotion Microservice
**Duration**: 4 hours  
**Owner**: Backend Dev

- [ ] Scaffold new NestJS app `promotion-app`
  ```bash
  nest generate app promotion-app
  ```
- [ ] Setup Prisma for promotion database
- [ ] Create Docker container for `promo_db` (port 5440)
- [ ] Update `docker-compose.yml` with promotion service
- [ ] Configure NATS connection

**Files**:
- `apps/promotion-app/src/main.ts`
- `apps/promotion-app/src/promotion.module.ts`
- `docker-compose.yml`

---

#### Task 1.3: Promotion Service - Database Schema
**Duration**: 3 hours  
**Owner**: Backend Dev

- [ ] Define `DiscountCode` model
- [ ] Define `DiscountUsage` model
- [ ] Create enums: `DiscountType`, `VipTier`
- [ ] Create Prisma migration
- [ ] Seed test discount codes

**Files**:
- `apps/promotion-app/prisma/schema.prisma`
- `apps/promotion-app/prisma/seed.ts`

---

#### Task 1.4: Shared Library - DTOs & Events
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Create promotion DTOs in `libs/shared/dto/promotion/`
  - `CreateDiscountCodeDto`
  - `ValidateDiscountDto`
  - `ApplyDiscountDto`
  - `UpdateVipTierDto`
- [ ] Add promotion events to `libs/shared/events.ts`
  ```typescript
  promotion: {
    CREATE_CODE: 'promotion.createCode',
    VALIDATE_CODE: 'promotion.validateCode',
    APPLY_CODE: 'promotion.applyCode',
    LIST_CODES: 'promotion.listCodes',
    // ...
  }
  ```

**Files**:
- `libs/shared/dto/promotion/`
- `libs/shared/events.ts`
- `libs/shared/types/promotion.types.ts`

---

### Phase 2: Core Business Logic (Days 4-7)

#### Task 2.1: User Service - VIP Tier Calculation Logic
**Duration**: 4 hours  
**Owner**: Backend Dev

- [ ] Implement `calculateTierFromSpending()` method
- [ ] Implement `recalculateVipTier()` method
  - Call Order Service to get `totalSpentInt`
  - Compare with thresholds
  - Update user tier if changed
- [ ] Subscribe to `order.completed` event
- [ ] Trigger tier recalculation on order completion

**Files**:
- `apps/user-app/src/user.service.ts`
- `apps/user-app/src/user.controller.ts`

**Tests**:
- Unit tests for tier calculation logic
- Mock Order Service responses

---

#### Task 2.2: User Service - Admin VIP Tier Override
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Implement `updateVipTier()` method (admin only)
- [ ] Set `vipTierOverride` and `tierReason`
- [ ] Validation: require admin role + reason
- [ ] Log tier change for audit

**Files**:
- `apps/user-app/src/user.service.ts`
- `apps/user-app/src/user.controller.ts`

---

#### Task 2.3: User Service - Get VIP Info Endpoint
**Duration**: 1.5 hours  
**Owner**: Backend Dev

- [ ] Implement `getVipInfo()` method
- [ ] Calculate discount rate based on tier
- [ ] Calculate next tier progress
- [ ] NATS message handler: `user.getVipInfo`

**Files**:
- `apps/user-app/src/user.service.ts`
- `apps/user-app/src/user.controller.ts`

---

#### Task 2.4: Promotion Service - Validate Discount Code
**Duration**: 4 hours  
**Owner**: Backend Dev

- [ ] Implement `validateDiscountCode()` method
  - Check code exists and active
  - Check expiry date
  - Check usage limits (global + per user)
  - Check minimum purchase amount
  - Check user VIP tier eligibility
- [ ] Calculate discount amount (percentage vs fixed)
- [ ] Return validation result with error codes

**Files**:
- `apps/promotion-app/src/promotion.service.ts`

**Tests**:
- Unit tests for all validation scenarios
- Edge cases: expired, tier mismatch, usage limits

---

#### Task 2.5: Promotion Service - Apply Discount Code
**Duration**: 3 hours  
**Owner**: Backend Dev

- [ ] Implement `applyDiscountCode()` method
  - Validate code (reuse validation logic)
  - Create `DiscountUsage` record
  - Increment `usedCount`
  - Atomic transaction
- [ ] Idempotency: prevent duplicate usage for same order

**Files**:
- `apps/promotion-app/src/promotion.service.ts`

**Tests**:
- Integration tests with database
- Idempotency tests

---

#### Task 2.6: Promotion Service - CRUD Operations (Admin)
**Duration**: 4 hours  
**Owner**: Backend Dev

- [ ] Implement `createDiscountCode()` (admin)
- [ ] Implement `listDiscountCodes()` with pagination/filters
- [ ] Implement `updateDiscountCode()` (admin)
- [ ] Implement `deleteDiscountCode()` (admin)
- [ ] Add RolesGuard for admin-only routes

**Files**:
- `apps/promotion-app/src/promotion.service.ts`
- `apps/promotion-app/src/promotion.controller.ts`
- `apps/promotion-app/src/guards/roles.guard.ts`

---

### Phase 3: Integration & API Gateway (Days 8-10)

#### Task 3.1: Gateway - Promotion Routes
**Duration**: 3 hours  
**Owner**: Backend Dev

- [ ] Add HTTP routes in Gateway:
  - `POST /api/promotions/codes` (admin)
  - `GET /api/promotions/codes` (admin)
  - `PATCH /api/promotions/codes/:id` (admin)
  - `DELETE /api/promotions/codes/:id` (admin)
  - `POST /api/promotions/codes/validate` (customer)
  - `POST /api/promotions/codes/apply` (customer)
- [ ] Map routes to NATS messages
- [ ] Add AuthGuard và RolesGuard

**Files**:
- `apps/gateway/src/app.controller.ts`
- `apps/gateway/src/modules/promotion.module.ts`

---

#### Task 3.2: Gateway - VIP Routes
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Add HTTP routes:
  - `GET /api/users/me/vip` (customer)
  - `PATCH /api/users/:id/vip-tier` (admin)
- [ ] Map to User Service NATS messages

**Files**:
- `apps/gateway/src/app.controller.ts`

---

#### Task 3.3: Order Service - Integration
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Publish `order.completed` event when order status = COMPLETED
- [ ] Include `userId`, `orderId`, `totalInt` in event payload
- [ ] Ensure event only published once per order

**Files**:
- `apps/order-app/src/order.service.ts`

---

#### Task 3.4: Order Service - Total Spent Calculation
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Add endpoint to calculate user's total spending
- [ ] Query all COMPLETED orders for user
- [ ] Sum `totalInt` field
- [ ] NATS message handler: `order.getTotalSpent`

**Files**:
- `apps/order-app/src/order.service.ts`
- `apps/order-app/src/order.controller.ts`

---

### Phase 4: Testing & Quality (Days 11-14)

#### Task 4.1: Unit Tests - User Service VIP Logic
**Duration**: 3 hours  
**Owner**: Backend Dev

- [ ] Test `calculateTierFromSpending()` với all thresholds
- [ ] Test `recalculateVipTier()` với order events
- [ ] Test admin override logic
- [ ] Mock Order Service responses
- [ ] Target: ≥90% coverage for VIP-related code

**Files**:
- `apps/user-app/src/user.service.spec.ts`

---

#### Task 4.2: Unit Tests - Promotion Service
**Duration**: 4 hours  
**Owner**: Backend Dev

- [ ] Test discount validation (all error scenarios)
- [ ] Test discount application (idempotency)
- [ ] Test CRUD operations
- [ ] Mock database with Prisma mocks
- [ ] Target: ≥90% coverage

**Files**:
- `apps/promotion-app/src/promotion.service.spec.ts`

---

#### Task 4.3: Integration Tests - E2E Flow
**Duration**: 4 hours  
**Owner**: Backend Dev

- [ ] Test full flow: Create user → Place orders → Tier auto-upgrade
- [ ] Test discount code application in checkout
- [ ] Test admin VIP tier override
- [ ] Use real test databases
- [ ] Cleanup test data after tests

**Files**:
- `apps/gateway/test/promotion.e2e-spec.ts`
- `apps/gateway/test/vip-tier.e2e-spec.ts`

---

#### Task 4.4: API Documentation
**Duration**: 2 hours  
**Owner**: Backend Dev

- [ ] Update Postman collection với new endpoints
- [ ] Add example requests/responses
- [ ] Document error codes
- [ ] Create HTTP client examples in `http/` folder

**Files**:
- `postman-collection.json`
- `http/promotion-app.http`

---

### Phase 5: Deployment & Monitoring (Days 15-16)

#### Task 5.1: Docker Configuration
**Duration**: 2 hours  
**Owner**: DevOps

- [ ] Create Dockerfile for `promotion-app`
- [ ] Update `docker-compose.yml` with all services
- [ ] Test local Docker deployment
- [ ] Verify inter-service communication

**Files**:
- `apps/promotion-app/Dockerfile`
- `docker-compose.yml`

---

#### Task 5.2: Database Migration - Production
**Duration**: 1 hour  
**Owner**: DevOps

- [ ] Run User Service migration on staging
- [ ] Run Promotion Service migration on staging
- [ ] Verify data integrity
- [ ] Prepare rollback plan

**Commands**:
```bash
# User Service
cd apps/user-app
npx prisma migrate deploy

# Promotion Service
cd apps/promotion-app
npx prisma migrate deploy
```

---

#### Task 5.3: Seed Production Data
**Duration**: 1 hour  
**Owner**: Backend Dev

- [ ] Create initial discount codes for each VIP tier
- [ ] Example: `BRONZE5`, `SILVER10`, `GOLD15`, `PLATINUM20`
- [ ] Set appropriate expiry dates
- [ ] Run seed script on production

**Files**:
- `scripts/seed-promotions.ts`

---

## Dependencies

### Critical Path
```
Task 1.1 (User Migration) → Task 2.1 (VIP Logic) → Task 3.2 (Gateway VIP Routes)
Task 1.2 (Promo Service) → Task 1.3 (Promo Schema) → Task 2.4 (Validation) → Task 3.1 (Gateway Routes)
```

### Blockers
- **Task 2.1** depends on Task 1.1 (User schema updated)
- **Task 2.4** depends on Task 1.3 (Promotion schema created)
- **Task 3.1, 3.2** depend on all Phase 2 tasks (business logic complete)
- **Task 4.3** depends on all Phase 3 tasks (integration complete)

### External Dependencies
- NATS server running (already available)
- PostgreSQL databases (provision 1 new database for Promotion Service)
- Order Service must publish `order.completed` event (Task 3.3)

## Timeline & Estimates

| Phase                  | Duration | Start Date  | End Date    |
| ---------------------- | -------- | ----------- | ----------- |
| Phase 1: Foundation    | 3 days   | Week 1 Mon  | Week 1 Wed  |
| Phase 2: Business Logic | 4 days   | Week 1 Thu  | Week 2 Tue  |
| Phase 3: Integration   | 3 days   | Week 2 Wed  | Week 2 Fri  |
| Phase 4: Testing       | 4 days   | Week 3 Mon  | Week 3 Thu  |
| Phase 5: Deployment    | 2 days   | Week 3 Fri  | Week 3 Sat  |
| **Total**              | **16 days** | **Week 1 Mon** | **Week 3 Sat** |

**Buffer**: +3 days cho unknowns = **Total 3 weeks**

### Effort Breakdown
- Foundation: 11 hours
- Business Logic: 18 hours
- Integration: 9 hours
- Testing: 13 hours
- Deployment: 4 hours
- **Total**: ~55 hours (~7 working days for 1 developer)

## Risks & Mitigation

### Risk 1: Complex VIP Tier Calculation Logic
**Probability**: Medium  
**Impact**: High (core feature)

**Mitigation**:
- Write comprehensive unit tests first (TDD approach)
- Use well-defined thresholds (configurable)
- Mock Order Service during development

---

### Risk 2: Database Migration Issues
**Probability**: Low  
**Impact**: High (production downtime)

**Mitigation**:
- Test migrations thoroughly on staging
- Prepare rollback scripts
- Schedule migration during low-traffic hours
- Use Prisma's transactional migrations

---

### Risk 3: NATS Event Ordering & Reliability
**Probability**: Medium  
**Impact**: Medium (tier updates delayed)

**Mitigation**:
- Use queue groups for load balancing
- Implement retry logic for failed events
- Add event logging for debugging
- Eventual consistency acceptable for VIP tier updates

---

### Risk 4: Discount Code Abuse
**Probability**: Low  
**Impact**: High (financial loss)

**Mitigation**:
- Strict validation (usage limits, expiry)
- Idempotency checks (1 code per order)
- Admin audit logs
- Rate limiting on validation endpoint

---

### Risk 5: Performance Bottlenecks
**Probability**: Low  
**Impact**: Medium (slow API responses)

**Mitigation**:
- Database indexes on frequently queried fields
- Cache VIP tier info (update on order completion)
- Pagination for admin code listings
- Load testing before production

---

## Resources Needed

### Team
- **1x Backend Developer**: Full-time (16 days)
- **0.5x DevOps Engineer**: Part-time (database setup, deployment)

### Infrastructure
- **1x PostgreSQL Database**: `promo_db` (port 5440)
- **1x NestJS Microservice**: `promotion-app` (port 3008)
- No additional third-party services required

### Tools & Services
- Prisma Studio: database management
- Postman: API testing
- Jest: unit and integration testing
- Docker: local development and deployment

### Documentation
- Backend design doc (already created)
- API documentation (Postman collection)
- Database schema diagrams (Prisma Studio auto-generates)

## Success Criteria

### Functional
- [ ] VIP tiers automatically calculated based on spending
- [ ] Admin can manually override VIP tiers
- [ ] Discount codes validate correctly (tier, expiry, usage limits)
- [ ] Discount codes apply to orders successfully
- [ ] Admin can CRUD discount codes
- [ ] Order completion triggers tier recalculation

### Technical
- [ ] Unit test coverage ≥ 90%
- [ ] Integration tests pass for all flows
- [ ] API response time < 200ms (p95)
- [ ] Database queries optimized with indexes
- [ ] No N+1 query issues
- [ ] All endpoints secured with auth guards

### Quality
- [ ] Code review approved
- [ ] Linter errors fixed (ESLint)
- [ ] TypeScript strict mode enabled
- [ ] Documentation complete
- [ ] Deployment successful on staging

