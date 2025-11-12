---
phase: testing
title: VIP Customer Management & Promotions - Backend Testing
description: Comprehensive test strategy for backend services
---

# Testing Strategy - Backend

## Test Coverage Goals

- **Unit Test Coverage**: ≥90% for new/changed code
- **Integration Test Scope**: All critical paths + error handling
- **E2E Test Scenarios**: Key user journeys (customer + admin)
- **Alignment**: All tests map to requirements and design acceptance criteria

## Unit Tests

### User Service - VIP Tier Logic

**File**: `apps/user-app/src/user.service.spec.ts`

#### Test Suite 1: calculateTierFromSpending

- [ ] **Test 1.1**: Returns STANDARD for spending < 5M VND
  - Input: `totalSpentInt = 400_000_000` (4M VND)
  - Expected: `VipTier.STANDARD`

- [ ] **Test 1.2**: Returns BRONZE for spending >= 5M VND
  - Input: `totalSpentInt = 500_000_000` (5M VND)
  - Expected: `VipTier.BRONZE`

- [ ] **Test 1.3**: Returns SILVER for spending >= 15M VND
  - Input: `totalSpentInt = 1_500_000_000` (15M VND)
  - Expected: `VipTier.SILVER`

- [ ] **Test 1.4**: Returns GOLD for spending >= 30M VND
  - Input: `totalSpentInt = 3_000_000_000` (30M VND)
  - Expected: `VipTier.GOLD`

- [ ] **Test 1.5**: Returns PLATINUM for spending >= 50M VND
  - Input: `totalSpentInt = 5_000_000_000` (50M VND)
  - Expected: `VipTier.PLATINUM`

- [ ] **Test 1.6**: Handles edge case at exact threshold
  - Input: `totalSpentInt = 500_000_001` (5M + 1 cent)
  - Expected: `VipTier.BRONZE`

```typescript
describe('UserService - calculateTierFromSpending', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService(/* mock dependencies */);
  });

  it('should return STANDARD for spending below 5M VND', () => {
    const tier = service['calculateTierFromSpending'](400_000_000);
    expect(tier).toBe(VipTier.STANDARD);
  });

  it('should return BRONZE for spending >= 5M VND', () => {
    const tier = service['calculateTierFromSpending'](500_000_000);
    expect(tier).toBe(VipTier.BRONZE);
  });

  // ... more tests
});
```

#### Test Suite 2: recalculateVipTier

- [ ] **Test 2.1**: Updates tier when spending crosses threshold
  - Setup: User with STANDARD tier, new spending = 6M VND
  - Expected: Tier updated to BRONZE, `updated = true`

- [ ] **Test 2.2**: Does not update tier if no change
  - Setup: User with BRONZE tier, new spending = 6M VND
  - Expected: `updated = false`, tier remains BRONZE

- [ ] **Test 2.3**: Respects manual tier override
  - Setup: User with `vipTierOverride = GOLD`, new spending = 2M VND (below BRONZE)
  - Expected: Tier remains GOLD, no update

- [ ] **Test 2.4**: Sends email notification on tier upgrade
  - Setup: Tier changes from BRONZE to SILVER
  - Expected: `sendTierChangeEmail()` called with correct params

- [ ] **Test 2.5**: Handles Order Service unavailable
  - Setup: Order Service returns error
  - Expected: Defaults to `totalSpentInt = 0`, no crash

```typescript
describe('UserService - recalculateVipTier', () => {
  it('should update tier when spending crosses threshold', async () => {
    // Mock Order Service
    mockOrderService.send.mockReturnValue(of({ totalSpentInt: 600_000_000 }));
    
    // Mock user with STANDARD tier
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      vipTier: VipTier.STANDARD,
      vipTierOverride: null,
    });

    const result = await service.recalculateVipTier('user-1');

    expect(result.newTier).toBe(VipTier.BRONZE);
    expect(result.updated).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ vipTier: VipTier.BRONZE }),
    });
  });
});
```

#### Test Suite 3: Admin Override

- [ ] **Test 3.1**: Admin can manually set VIP tier
  - Input: Admin sets user to PLATINUM
  - Expected: `vipTier = PLATINUM`, `vipTierOverride = PLATINUM`

- [ ] **Test 3.2**: Requires reason for audit
  - Input: No reason provided
  - Expected: Validation error

- [ ] **Test 3.3**: Logs admin action
  - Expected: Logger called with admin ID and reason

---

### Promotion Service - Discount Validation

**File**: `apps/promotion-app/src/promotion.service.spec.ts`

#### Test Suite 4: validateDiscountCode

- [ ] **Test 4.1**: Valid code returns success
  - Setup: Active code, valid tier, not expired
  - Expected: `{ valid: true, discountedInt: 10000 }`

- [ ] **Test 4.2**: Expired code returns error
  - Setup: Code with `expiresAt` in past
  - Expected: `{ valid: false, error: 'CODE_EXPIRED' }`

- [ ] **Test 4.3**: Inactive code returns error
  - Setup: Code with `isActive = false`
  - Expected: `{ valid: false, error: 'CODE_INACTIVE' }`

- [ ] **Test 4.4**: Tier mismatch returns error
  - Setup: GOLD code, user has BRONZE tier
  - Expected: `{ valid: false, error: 'TIER_NOT_MET' }`

- [ ] **Test 4.5**: Max usage reached returns error
  - Setup: Code with `usedCount = maxUsages`
  - Expected: `{ valid: false, error: 'MAX_USAGE_REACHED' }`

- [ ] **Test 4.6**: Minimum purchase not met returns error
  - Setup: Code requires 10M VND, subtotal = 5M VND
  - Expected: `{ valid: false, error: 'MIN_PURCHASE_NOT_MET' }`

- [ ] **Test 4.7**: Percentage discount calculated correctly
  - Setup: 10% code, subtotal = 1,000,000
  - Expected: `discountedInt = 100,000`

- [ ] **Test 4.8**: Fixed amount discount calculated correctly
  - Setup: 50,000 VND code, subtotal = 200,000
  - Expected: `discountedInt = 50,000`

- [ ] **Test 4.9**: Fixed discount doesn't exceed subtotal
  - Setup: 100,000 VND code, subtotal = 50,000
  - Expected: `discountedInt = 50,000`

```typescript
describe('PromotionService - validateDiscountCode', () => {
  it('should return error for expired code', async () => {
    mockPrisma.discountCode.findUnique.mockResolvedValue({
      id: 'code-1',
      code: 'EXPIRED',
      isActive: true,
      expiresAt: new Date('2023-01-01'), // Past date
      // ... other fields
    });

    const result = await service.validateDiscountCode('EXPIRED', 'user-1', 100_000_000);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('CODE_EXPIRED');
  });

  it('should calculate percentage discount correctly', async () => {
    mockPrisma.discountCode.findUnique.mockResolvedValue({
      type: DiscountType.PERCENTAGE,
      value: 10,
      isActive: true,
      expiresAt: null,
      requiredTier: null,
      // ... other fields
    });

    const result = await service.validateDiscountCode('CODE10', 'user-1', 100_000_000);

    expect(result.valid).toBe(true);
    expect(result.discountedInt).toBe(10_000_000); // 10% of 100M
  });
});
```

#### Test Suite 5: applyDiscountCode

- [ ] **Test 5.1**: Creates usage record and increments count
  - Expected: `DiscountUsage` created, `usedCount` incremented

- [ ] **Test 5.2**: Idempotency - returns existing if already applied
  - Setup: Code already applied to order
  - Expected: Returns existing usage, no new record

- [ ] **Test 5.3**: Transaction rollback on error
  - Setup: Database error during creation
  - Expected: No partial data saved

- [ ] **Test 5.4**: Throws error if validation fails
  - Setup: Invalid code
  - Expected: Throws `BadRequestException`

---

### Promotion Service - CRUD Operations

#### Test Suite 6: Admin CRUD

- [ ] **Test 6.1**: Create discount code successfully
  - Expected: Code saved to database, uppercase

- [ ] **Test 6.2**: List codes with pagination
  - Expected: Returns paginated results

- [ ] **Test 6.3**: Filter codes by tier
  - Input: `tier = GOLD`
  - Expected: Only GOLD-tier codes returned

- [ ] **Test 6.4**: Search codes by name
  - Input: `search = "SUMMER"`
  - Expected: Returns matching codes

- [ ] **Test 6.5**: Update code successfully
  - Input: Change `isActive = false`
  - Expected: Code deactivated

- [ ] **Test 6.6**: Delete code successfully
  - Expected: Code removed from database

---

## Integration Tests

### Integration Scenario 1: Order Completion → Tier Update

**File**: `apps/gateway/test/vip-tier-integration.e2e-spec.ts`

- [ ] **Scenario 1.1**: Customer places order, tier automatically upgraded
  - Steps:
    1. Create user with 4M VND spending (STANDARD tier)
    2. Place order worth 2M VND, mark as COMPLETED
    3. Check user tier
  - Expected: User tier updated to BRONZE

- [ ] **Scenario 1.2**: Multiple orders accumulate spending
  - Steps:
    1. Create user
    2. Place 3 orders: 2M, 2M, 2M (total 6M)
    3. Mark all as COMPLETED
  - Expected: Tier = BRONZE after accumulation

- [ ] **Scenario 1.3**: Manual override prevents auto-update
  - Steps:
    1. Admin sets user to PLATINUM manually
    2. User places small order (100K VND)
  - Expected: Tier remains PLATINUM

```typescript
describe('VIP Tier Integration (E2E)', () => {
  it('should auto-upgrade tier after order completion', async () => {
    // 1. Create user
    const user = await createTestUser({ totalSpentInt: 400_000_000 });

    // 2. Create and complete order
    const order = await createTestOrder({
      userId: user.id,
      totalInt: 200_000_000, // 2M VND
    });
    await updateOrderStatus(order.id, OrderStatus.COMPLETED);

    // 3. Wait for event processing
    await sleep(1000);

    // 4. Verify tier updated
    const updatedUser = await getUserById(user.id);
    expect(updatedUser.vipTier).toBe(VipTier.BRONZE);
  });
});
```

---

### Integration Scenario 2: Apply Discount Code in Checkout

**File**: `apps/gateway/test/promotion-integration.e2e-spec.ts`

- [ ] **Scenario 2.1**: Valid code applied successfully
  - Steps:
    1. Create GOLD-tier user
    2. Create GOLD discount code (10%)
    3. Validate code with 10M VND subtotal
    4. Apply code to order
  - Expected: Usage created, discount = 1M VND

- [ ] **Scenario 2.2**: Tier check prevents unauthorized use
  - Steps:
    1. Create BRONZE-tier user
    2. Try to use GOLD-tier code
  - Expected: Validation fails with `TIER_NOT_MET`

- [ ] **Scenario 2.3**: Max usage limit enforced
  - Steps:
    1. Create code with `maxUsages = 2`
    2. Apply code to 2 orders
    3. Try to apply to 3rd order
  - Expected: Validation fails with `MAX_USAGE_REACHED`

```typescript
describe('Promotion Integration (E2E)', () => {
  it('should apply discount code successfully', async () => {
    // Setup
    const user = await createTestUser({ vipTier: VipTier.GOLD });
    const code = await createTestDiscountCode({
      code: 'GOLD10',
      type: DiscountType.PERCENTAGE,
      value: 10,
      requiredTier: VipTier.GOLD,
    });

    // Validate
    const validation = await request(app.getHttpServer())
      .post('/api/promotions/codes/validate')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ code: 'GOLD10', subtotalInt: 1_000_000_000 })
      .expect(200);

    expect(validation.body.valid).toBe(true);
    expect(validation.body.discountedInt).toBe(100_000_000);

    // Apply
    const order = await createTestOrder({ userId: user.id });
    const apply = await request(app.getHttpServer())
      .post('/api/promotions/codes/apply')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        code: 'GOLD10',
        orderId: order.id,
        subtotalInt: 1_000_000_000,
      })
      .expect(200);

    expect(apply.body.success).toBe(true);

    // Verify usage created
    const usage = await getDiscountUsage(order.id);
    expect(usage).toBeDefined();
    expect(usage.discountedInt).toBe(100_000_000);
  });
});
```

---

## End-to-End Tests

### User Flow 1: Customer Journey

- [ ] **E2E 1.1**: Customer signs up → Places orders → Gets VIP status
  - Steps:
    1. Register new user
    2. Place order worth 5M VND
    3. Complete order
    4. Get VIP info
  - Expected: VIP tier = BRONZE, discount rate = 5%

- [ ] **E2E 1.2**: VIP customer uses discount code in checkout
  - Steps:
    1. Login as GOLD-tier user
    2. Add products to cart (total 10M VND)
    3. Apply GOLD10 discount code
    4. Complete checkout
  - Expected: Order total = 9M VND, discount applied

---

### Admin Flow 1: Discount Code Management

- [ ] **E2E 2.1**: Admin creates and manages discount codes
  - Steps:
    1. Login as admin
    2. Create new code "SUMMER20" (20% off, SILVER+)
    3. Edit code (change to 15%)
    4. Deactivate code
    5. Delete code
  - Expected: All CRUD operations succeed

- [ ] **E2E 2.2**: Admin manually upgrades customer VIP tier
  - Steps:
    1. Login as admin
    2. View customer list
    3. Select customer, change tier to PLATINUM
    4. Provide reason: "Loyal customer compensation"
  - Expected: Tier updated, reason saved

---

## Test Data

### Fixtures

```typescript
// test/fixtures/users.fixture.ts
export const testUsers = {
  standardCustomer: {
    email: 'standard@test.com',
    vipTier: VipTier.STANDARD,
    totalSpentInt: 0,
  },
  bronzeCustomer: {
    email: 'bronze@test.com',
    vipTier: VipTier.BRONZE,
    totalSpentInt: 600_000_000, // 6M VND
  },
  goldCustomer: {
    email: 'gold@test.com',
    vipTier: VipTier.GOLD,
    totalSpentInt: 3_500_000_000, // 35M VND
  },
  admin: {
    email: 'admin@test.com',
    role: 'ADMIN',
  },
};

// test/fixtures/discount-codes.fixture.ts
export const testDiscountCodes = {
  bronze5: {
    code: 'BRONZE5',
    type: DiscountType.PERCENTAGE,
    value: 5,
    requiredTier: VipTier.BRONZE,
    isActive: true,
  },
  gold10: {
    code: 'GOLD10',
    type: DiscountType.PERCENTAGE,
    value: 10,
    requiredTier: VipTier.GOLD,
    isActive: true,
  },
  fixed50k: {
    code: 'FIXED50K',
    type: DiscountType.FIXED_AMOUNT,
    value: 50_000_000, // 500K VND
    requiredTier: null, // Public
    isActive: true,
  },
  expired: {
    code: 'EXPIRED',
    expiresAt: new Date('2023-01-01'),
    isActive: false,
  },
};
```

### Seed Data for Testing

```typescript
// test/seed-test-data.ts
export async function seedTestData(prisma: PrismaClient) {
  // Create test users
  await prisma.user.createMany({
    data: Object.values(testUsers),
  });

  // Create test discount codes
  await prisma.discountCode.createMany({
    data: Object.values(testDiscountCodes),
  });

  // Create test orders
  await prisma.order.createMany({
    data: [
      {
        userId: 'bronze-user-id',
        totalInt: 600_000_000,
        status: OrderStatus.COMPLETED,
      },
    ],
  });
}
```

---

## Test Reporting & Coverage

### Coverage Commands

```bash
# Unit tests with coverage
pnpm test:cov apps/user-app
pnpm test:cov apps/promotion-app

# Integration tests
pnpm test:e2e apps/gateway

# All tests
pnpm test:all
```

### Coverage Thresholds

```json
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
```

### Coverage Gaps

**Acceptable gaps (<100%)**:
- Error handling for external API failures (mocked)
- Email sending (integration with email service)
- Logging statements

**Must cover**:
- All business logic (tier calculation, discount validation)
- All CRUD operations
- All validation rules

---

## Manual Testing

### Smoke Tests (After Deployment)

- [ ] **Smoke 1**: Verify all services are running
  ```bash
  curl http://localhost:3008/health # Promotion Service
  curl http://localhost:3001/health # User Service
  ```

- [ ] **Smoke 2**: Create discount code via API
- [ ] **Smoke 3**: Apply discount code in checkout
- [ ] **Smoke 4**: Verify VIP tier update after order completion

### Database Testing

- [ ] Verify migrations applied successfully
- [ ] Check indexes created
- [ ] Validate data integrity (no orphaned records)

---

## Performance Testing

### Load Testing Scenarios

**Tool**: Apache JMeter or Artillery

- [ ] **Load 1**: 1000 concurrent discount validations
  - Expected: p95 latency < 50ms

- [ ] **Load 2**: 100 concurrent tier recalculations
  - Expected: p95 latency < 200ms

- [ ] **Load 3**: Admin listing 10,000 discount codes
  - Expected: Pagination works, p95 latency < 500ms

### Performance Benchmarks

| Endpoint                          | Target Latency (p95) |
| --------------------------------- | -------------------- |
| POST /promotions/codes/validate   | < 50ms               |
| GET /users/me/vip                 | < 100ms              |
| POST /promotions/codes (create)   | < 150ms              |
| GET /promotions/codes (list)      | < 200ms              |
| PATCH /users/:id/vip-tier (admin) | < 150ms              |

---

## Bug Tracking

### Issue Template

```markdown
**Bug ID**: PROM-001
**Severity**: High
**Component**: Promotion Service - Discount Validation
**Description**: Percentage discount rounds incorrectly for large amounts
**Steps to Reproduce**:
1. Create code with 10% discount
2. Apply to order with subtotal = 999,999,999
3. Discount calculated as 99,999,998 (should be 99,999,999)

**Expected**: Math.floor() rounding
**Actual**: Math.round() rounding
**Fix**: Update calculation logic in promotion.service.ts line 142
```

### Regression Testing Strategy

- [ ] After each bug fix, add regression test
- [ ] Run full test suite before production deployment
- [ ] Monitor error rates in production (datadog/sentry)

---

## Test Execution Checklist

### Before Merging PR

- [ ] All unit tests pass
- [ ] Coverage ≥ 90%
- [ ] Integration tests pass
- [ ] No linter errors
- [ ] Manual testing completed

### Before Production Deployment

- [ ] E2E tests pass on staging
- [ ] Performance tests pass
- [ ] Database migrations tested
- [ ] Smoke tests completed
- [ ] Rollback plan documented

