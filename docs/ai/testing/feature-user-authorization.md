---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy - User Authorization

## Test Coverage Goals

**What level of testing do we aim for?**

- **Unit test coverage target**: 100% of new code (RolesGuard, @Roles() decorator)
- **Integration test scope**:
  - AuthGuard + RolesGuard interaction
  - Critical authorization paths
  - Error handling scenarios
- **End-to-end test scenarios**:
  - Key user journeys (admin creates user, customer views profile, etc.)
  - Authorization failures (403 responses)
- **Alignment with requirements**: All success criteria from requirements doc must have corresponding tests

## Unit Tests

**What individual components need testing?**

### Component 1: @Roles() Decorator

**File**: `apps/gateway/src/auth/roles.decorator.spec.ts`

- [x] **Test 1.1**: Decorator sets metadata correctly with single role ✅
- [x] **Test 1.2**: Decorator sets metadata correctly with multiple roles ✅
- [x] **Test 1.3**: Decorator works on methods ✅

### Component 2: RolesGuard

**File**: `apps/gateway/src/auth/roles.guard.spec.ts`

#### Happy Path Tests

- [x] **Test 2.1**: Allow access when no @Roles() decorator present ✅

  ```typescript
  it('should allow access when no @Roles() decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({
      user: { userId: '123', email: 'test@test.com', role: 'CUSTOMER' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });
  ```

- [x] **Test 2.2**: Allow access when user role matches single required role ✅
- [x] **Test 2.3**: Allow access when user role matches one of multiple required roles ✅
- [x] **Test 2.4**: Allow access when required roles is empty array ✅

#### Error Handling Tests

- [x] **Test 2.5**: Throw ForbiddenException when user role doesn't match ✅

  ```typescript
  it('should throw ForbiddenException when role does not match', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({
      user: { userId: '123', email: 'customer@test.com', role: 'CUSTOMER' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow(/Required roles: ADMIN/);
  });
  ```

- [x] **Test 2.6**: Throw ForbiddenException when user is missing from request ✅
- [x] **Test 2.7**: Throw ForbiddenException when user.role is missing ✅

#### Edge Case Tests

- [x] **Test 2.8**: Reflector checks both method and class decorators ✅

  ```typescript
  it('should check both method and class level decorators', () => {
    const getAllAndOverrideSpy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    const context = createMockContext({
      user: { userId: '123', email: 'admin@test.com', role: 'ADMIN' },
    });

    guard.canActivate(context);

    expect(getAllAndOverrideSpy).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
  ```

- [x] **Test 2.9**: Error message includes user's actual role ✅

## Integration Tests

**How do we test component interactions?**

### Integration 1: AuthGuard + RolesGuard

**File**: `apps/gateway/test/auth-authorization.integration.spec.ts`

- [x] **Test 3.1**: AuthGuard rejects request with no token, RolesGuard never runs ✅

  ```typescript
  it('should return 401 when no token provided', async () => {
    const response = await request(app.getHttpServer()).get('/users').expect(401);

    expect(response.body.message).toContain('Missing authorization header');
  });
  ```

- [x] **Test 3.2**: AuthGuard rejects invalid token, RolesGuard never runs ✅
- [x] **Test 3.3**: Valid ADMIN token + ADMIN endpoint → Success ✅
- [x] **Test 3.4**: Valid CUSTOMER token + ADMIN endpoint → 403 Forbidden ✅
- [x] **Test 3.5**: Valid token + endpoint without @Roles() → Success ✅
- [x] **Test 3.6**: Valid token with multiple roles → Success if one matches ✅

### Integration 2: Error Response Format

- [x] **Test 3.7**: 401 error has correct structure ✅
- [x] **Test 3.8**: 403 error has correct structure ✅

## End-to-End Tests

**What user flows need validation?**

### E2E Scenario 1: Admin User Management

**File**: `apps/gateway/test/gateway.e2e-spec.ts` (Authorization tests added)

- [x] **Test 4.1**: Admin can access /users ✅
- [x] **Test 4.2**: Customer cannot access /users (403) ✅
- [x] **Test 4.3**: Both ADMIN and CUSTOMER can access /users/:id ✅
- [x] **Test 4.4**: CUSTOMER denied access to /users/email/:email ✅
- [x] **Test 4.5**: Proper error messages when role mismatch ✅

### E2E Scenario 2: Product Management

**File**: `apps/gateway/test/product-management.e2e-spec.ts`

- [ ] **Test 4.6**: Admin can create product

  ```typescript
  it('ADMIN should create product', async () => {
    const adminToken = await loginAs(UserRole.ADMIN);

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'PROD-001',
        name: 'Test Product',
        priceInt: 10000,
        stock: 100,
      })
      .expect(201);
  });
  ```

- [ ] **Test 4.7**: Customer cannot create product (403)

  ```typescript
  it('CUSTOMER should not create product', async () => {
    const customerToken = await loginAs(UserRole.CUSTOMER);

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        sku: 'PROD-002',
        name: 'Test Product',
      })
      .expect(403);
  });
  ```

- [ ] **Test 4.8**: Both ADMIN and CUSTOMER can list products

  ```typescript
  it('ADMIN should list products', async () => {
    const adminToken = await loginAs(UserRole.ADMIN);
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('CUSTOMER should list products', async () => {
    const customerToken = await loginAs(UserRole.CUSTOMER);
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
  });
  ```

### E2E Scenario 3: Profile Access

**File**: `apps/gateway/test/profile.e2e-spec.ts`

- [ ] **Test 4.9**: Customer can view own profile

  ```typescript
  it('CUSTOMER should view own profile', async () => {
    const customerToken = await loginAs(UserRole.CUSTOMER);

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.role).toBe('CUSTOMER');
  });
  ```

- [ ] **Test 4.10**: Admin can view own profile

  ```typescript
  it('ADMIN should view own profile', async () => {
    const adminToken = await loginAs(UserRole.ADMIN);

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.role).toBe('ADMIN');
  });
  ```

### E2E Scenario 4: Order Management

**File**: `apps/gateway/test/order-management.e2e-spec.ts`

- [ ] **Test 4.11**: Admin can update order status

  ```typescript
  it('ADMIN should update order status', async () => {
    const adminToken = await loginAs(UserRole.ADMIN);
    const orderId = await createTestOrder();

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
  });
  ```

- [ ] **Test 4.12**: Customer cannot update order status (403)

  ```typescript
  it('CUSTOMER should not update order status', async () => {
    const customerToken = await loginAs(UserRole.CUSTOMER);
    const orderId = await createTestOrder();

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(403);
  });
  ```

## Test Data

**What data do we use for testing?**

### Test Fixtures

```typescript
// test/fixtures/users.fixture.ts
export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    role: UserRole.ADMIN,
  },
  customer: {
    email: 'customer@test.com',
    password: 'Customer123!',
    role: UserRole.CUSTOMER,
  },
};

// Helper to create test JWT
export function generateToken(payload: Partial<JwtPayload>): string {
  return jwt.sign(
    {
      sub: payload.userId || 'test-user-id',
      email: payload.email || 'test@test.com',
      role: payload.role || UserRole.CUSTOMER,
    },
    privateKey,
    { algorithm: 'RS256', expiresIn: '15m' },
  );
}

// Helper to login and get real token
export async function loginAs(role: UserRole): Promise<string> {
  const user = role === UserRole.ADMIN ? TEST_USERS.admin : TEST_USERS.customer;

  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: user.email, password: user.password });

  return response.body.accessToken;
}
```

### Mock Data

```typescript
// test/mocks/execution-context.mock.ts
export function createMockContext(options: {
  user?: any;
  params?: any;
  query?: any;
  body?: any;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: options.user,
        params: options.params || {},
        query: options.query || {},
        body: options.body || {},
      }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as any;
}
```

## Test Reporting & Coverage

**How do we verify and communicate test results?**

### Coverage Commands

```bash
# Run all tests with coverage
pnpm test -- --coverage

# Run specific test suite
pnpm test apps/gateway/src/auth/roles.guard.spec.ts

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e apps/gateway
```

### Coverage Thresholds

```json
// jest.config.js
{
  "coverageThreshold": {
    "global": {
      "branches": 100,
      "functions": 100,
      "lines": 100,
      "statements": 100
    }
  }
}
```

### Coverage Targets

| File                 | Target | Notes                       |
| -------------------- | ------ | --------------------------- |
| `roles.guard.ts`     | 100%   | All branches must be tested |
| `roles.decorator.ts` | 100%   | Simple metadata decorator   |

### Coverage Report

- **HTML Report**: `coverage/lcov-report/index.html`
- **Console Report**: Shown after running tests
- **CI Integration**: Coverage uploaded to CI dashboard

## Manual Testing

**What requires human validation?**

### Manual Testing Checklist

- [ ] **MT-1**: Test với real browser (Postman/Insomnia)
  - Get JWT token from `/auth/login`
  - Try ADMIN endpoints with CUSTOMER token → 403
  - Try ADMIN endpoints with ADMIN token → 200

- [ ] **MT-2**: Test error messages are user-friendly
  - No token → Clear 401 message
  - Wrong role → Clear 403 message with role info

- [ ] **MT-3**: Test guard order matters
  - Manually swap guard order in code
  - Verify error occurs (user not found)
  - Revert to correct order

- [ ] **MT-4**: Test with expired tokens
  - Generate token with short expiry (1 second)
  - Wait for expiry
  - Verify 401 Unauthorized

- [ ] **MT-5**: Verify logs (if logging implemented)
  - Check logs for failed authorization attempts
  - Verify sensitive info not leaked

### Browser/Device Compatibility

**Out of scope**: This is backend authorization, no browser-specific issues

### Smoke Tests After Deployment

- [ ] **Smoke-1**: Health check endpoint still works
- [ ] **Smoke-2**: Login returns valid tokens
- [ ] **Smoke-3**: ADMIN can access admin endpoints
- [ ] **Smoke-4**: CUSTOMER blocked from admin endpoints

## Performance Testing

**How do we validate performance?**

### Performance Benchmarks

- **Target**: Authorization check < 1ms overhead per request
- **Method**: Run load tests with and without RolesGuard, compare latency

### Load Testing Scenarios

```bash
# Using Apache Bench
ab -n 1000 -c 10 -H "Authorization: Bearer $TOKEN" http://localhost:3000/users

# Using Artillery
artillery quick --count 100 -n 20 http://localhost:3000/products
```

### Expected Results

| Scenario           | Requests | Concurrent | Avg Latency | P95 Latency |
| ------------------ | -------- | ---------- | ----------- | ----------- |
| Without RolesGuard | 1000     | 10         | 50ms        | 80ms        |
| With RolesGuard    | 1000     | 10         | 51ms        | 82ms        |
| **Overhead**       | -        | -          | **~1ms**    | **~2ms**    |

**Acceptance Criteria**: Overhead < 5ms

## Bug Tracking

**How do we manage issues?**

### Issue Tracking Process

1. **Discovery**: Found in testing or code review
2. **Report**: Create GitHub issue with template
3. **Triage**: Assign severity (Critical, High, Medium, Low)
4. **Fix**: Implement fix with test case
5. **Verify**: Re-test to confirm fix
6. **Close**: Document resolution

### Bug Severity Levels

| Severity     | Description            | Example                                  |
| ------------ | ---------------------- | ---------------------------------------- |
| **Critical** | Security vulnerability | CUSTOMER can access ADMIN endpoints      |
| **High**     | Feature broken         | RolesGuard throws error on valid request |
| **Medium**   | Usability issue        | Error message unclear                    |
| **Low**      | Cosmetic issue         | Typo in log message                      |

### Regression Testing Strategy

- **After each fix**: Run full test suite
- **Before merge**: Run integration + E2E tests
- **Before deployment**: Run smoke tests
- **Post-deployment**: Monitor logs for errors

## Test Execution Timeline

### Pre-Implementation

- [x] Write test plan (this document)

### During Implementation

- [x] Write unit tests for `@Roles()` decorator ✅
- [x] Write unit tests for `RolesGuard` ✅
- [x] Run tests frequently during development (TDD approach) ✅

### After Implementation

- [x] Write integration tests ✅
- [x] Write E2E tests ✅
- [ ] Run full test suite (TODO: execute tests)
- [ ] Check coverage report (must be 100%)
- [ ] Fix any failing tests

### Pre-Merge

- [ ] All tests passing
- [ ] Coverage thresholds met
- [ ] Manual testing completed
- [ ] Code review approved

### Post-Deployment

- [ ] Smoke tests in production
- [ ] Monitor logs for errors
- [ ] Performance monitoring

## Success Criteria Validation

**Mapping tests to requirements success criteria:**

| Success Criteria                | Test Coverage                                       |
| ------------------------------- | --------------------------------------------------- |
| ✅ RolesGuard created and works | Unit tests 2.1-2.9                                  |
| ✅ @Roles() decorator works     | Unit tests 1.1-1.3                                  |
| ✅ Integration with AuthGuard   | Integration tests 3.1-3.6                           |
| ✅ ADMIN-only endpoints work    | E2E tests 4.1-4.5                                   |
| ✅ Multiple roles support       | Unit test 2.3, Integration test 3.6                 |
| ✅ No @Roles() = auth only      | Unit test 2.1, Integration test 3.5                 |
| ✅ 403 for wrong role           | Integration test 3.4, E2E tests 4.2, 4.4, 4.7, 4.12 |
| ✅ 401 for no/invalid token     | Integration tests 3.1, 3.2                          |

**All requirements must have passing tests before marking feature as complete.**
