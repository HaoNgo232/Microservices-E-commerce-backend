---
phase: design
title: VIP Customer Management & Promotions - Backend Design
description: Database schema, API endpoints, và business logic cho VIP system
---

# System Design & Architecture - Backend

## Architecture Overview

### High-Level Flow

```mermaid
graph TB
    Gateway["API Gateway<br/>:3000"]
    
    UserService["User Service<br/>VIP Tier Logic"]
    PromoService["Promotion Service<br/>NEW - :3008"]
    OrderService["Order Service<br/>Calculate Spending"]
    
    Gateway -->|NATS| UserService
    Gateway -->|NATS| PromoService
    Gateway -->|NATS| OrderService
    
    UserService --> UserDB["User DB<br/>+ vipTier field"]
    PromoService --> PromoDB["Promotion DB<br/>NEW"]
    OrderService --> OrderDB["Order DB"]
    
    OrderService -.->|Event: order.completed| UserService
    UserService -.->|Recalculate Tier| UserService
    
    PromoService -.->|Validate Code| PromoService
    OrderService -.->|Apply Discount| PromoService
    
    style PromoService fill:#FF6B6B,stroke:#C92A2A,color:#fff
    style PromoDB fill:#FF6B6B,stroke:#C92A2A,color:#fff
```

### Design Decisions

**Option 1: New Microservice `promotion-app` ✓ CHỌN**
- Lý do: Promotion logic phức tạp, độc lập với User/Order
- Trade-off: Thêm service mới, nhưng scalable và maintainable

**Option 2: Extend User Service ✗ REJECTED**
- Lý do: User service đã handle user CRUD, thêm promotion làm bloated
- Trade-off: Ít services nhưng violates Single Responsibility

## Data Models

### 1. User Service - Extended Schema

**File**: `apps/user-app/prisma/schema.prisma`

```prisma
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  passwordHash    String
  fullName        String?
  phone           String?
  role            String   @default("CUSTOMER")
  isActive        Boolean  @default(true)
  
  // VIP Fields (NEW)
  vipTier         VipTier? @default(STANDARD)
  vipTierOverride VipTier? // Manual override by admin
  totalSpentInt   Int      @default(0) // Cached total spending (cents)
  tierUpdatedAt   DateTime?
  tierReason      String?  // Reason for manual tier change
  
  addresses       Address[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum VipTier {
  STANDARD  // Default - no VIP
  BRONZE    // 5M+ VND
  SILVER    // 15M+ VND
  GOLD      // 30M+ VND
  PLATINUM  // 50M+ VND
}
```

**Migration Plan**:
```sql
ALTER TABLE "User" ADD COLUMN "vipTier" TEXT DEFAULT 'STANDARD';
ALTER TABLE "User" ADD COLUMN "vipTierOverride" TEXT;
ALTER TABLE "User" ADD COLUMN "totalSpentInt" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "tierUpdatedAt" TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "tierReason" TEXT;
```

### 2. Promotion Service - New Schema

**File**: `apps/promotion-app/prisma/schema.prisma`

```prisma
model DiscountCode {
  id          String    @id @default(cuid())
  code        String    @unique // e.g., "GOLD10"
  description String?
  
  // Discount Configuration
  type        DiscountType // PERCENTAGE or FIXED_AMOUNT
  value       Int       // For PERCENTAGE: 10 = 10%, For FIXED_AMOUNT: cents
  
  // VIP Tier Restrictions
  requiredTier VipTier? // null = public code, BRONZE = Bronze+ only
  
  // Usage Limits
  maxUsages   Int?      // null = unlimited
  usedCount   Int       @default(0)
  maxUsagePerUser Int?  // null = unlimited per user
  
  // Validity
  startsAt    DateTime? // null = starts immediately
  expiresAt   DateTime? // null = never expires
  isActive    Boolean   @default(true)
  
  // Minimum Purchase
  minPurchaseInt Int?   // null = no minimum
  
  // Audit
  createdBy   String    // Admin user ID
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  usages      DiscountUsage[]
}

model DiscountUsage {
  id             String   @id @default(cuid())
  discountCodeId String
  discountCode   DiscountCode @relation(fields: [discountCodeId], references: [id])
  
  orderId        String   @unique // One discount per order
  userId         String
  discountedInt  Int      // Amount discounted (cents)
  
  createdAt      DateTime @default(now())
  
  @@index([userId])
  @@index([discountCodeId])
}

enum DiscountType {
  PERCENTAGE    // e.g., 10%
  FIXED_AMOUNT  // e.g., 50,000 VND
}

enum VipTier {
  STANDARD
  BRONZE
  SILVER
  GOLD
  PLATINUM
}
```

## API Design

### User Service - New Endpoints

**1. Calculate & Update VIP Tier**
```typescript
// NATS Event: user.calculateVipTier
interface CalculateVipTierDto {
  userId: string;
}

interface CalculateVipTierResponse {
  userId: string;
  oldTier: VipTier;
  newTier: VipTier;
  totalSpentInt: number;
  updated: boolean;
}
```

**2. Admin Override VIP Tier**
```typescript
// NATS Event: user.updateVipTier
interface UpdateVipTierDto {
  userId: string;
  newTier: VipTier;
  reason: string; // Required for audit
  adminId: string;
}

interface UpdateVipTierResponse {
  success: boolean;
  user: {
    id: string;
    vipTier: VipTier;
    vipTierOverride: VipTier;
    tierReason: string;
  }
}
```

**3. Get VIP Info**
```typescript
// NATS Event: user.getVipInfo
interface GetVipInfoDto {
  userId: string;
}

interface VipInfoResponse {
  userId: string;
  currentTier: VipTier;
  totalSpentInt: number;
  discountRate: number; // Calculated based on tier
  nextTier?: {
    tier: VipTier;
    requiredSpending: number;
    remaining: number;
  }
}
```

### Promotion Service - New Endpoints

**Gateway Routes**: `/api/promotions/*`

**1. Create Discount Code (Admin)**
```http
POST /api/promotions/codes
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "code": "GOLD10",
  "description": "10% off for Gold members",
  "type": "PERCENTAGE",
  "value": 10,
  "requiredTier": "GOLD",
  "maxUsages": 100,
  "expiresAt": "2025-12-31T23:59:59Z",
  "minPurchaseInt": 50000000
}

Response 201:
{
  "id": "cm123abc",
  "code": "GOLD10",
  "type": "PERCENTAGE",
  "value": 10,
  "requiredTier": "GOLD",
  ...
}
```

**2. List Discount Codes (Admin)**
```http
GET /api/promotions/codes?page=1&limit=20&tier=GOLD&status=active
Authorization: Bearer <admin-jwt>

Response 200:
{
  "data": [
    {
      "id": "cm123abc",
      "code": "GOLD10",
      "type": "PERCENTAGE",
      "value": 10,
      "usedCount": 45,
      "maxUsages": 100,
      ...
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

**3. Validate Discount Code (Customer)**
```http
POST /api/promotions/codes/validate
Authorization: Bearer <customer-jwt>
Content-Type: application/json

{
  "code": "GOLD10",
  "userId": "cm456def",
  "subtotalInt": 100000000
}

Response 200:
{
  "valid": true,
  "discountCode": {
    "id": "cm123abc",
    "code": "GOLD10",
    "type": "PERCENTAGE",
    "value": 10
  },
  "discountedInt": 10000000,
  "finalTotalInt": 90000000
}

Response 400 (Invalid):
{
  "valid": false,
  "error": "CODE_EXPIRED" | "TIER_NOT_MET" | "MAX_USAGE_REACHED" | "MIN_PURCHASE_NOT_MET"
}
```

**4. Apply Discount to Order**
```http
POST /api/promotions/codes/apply
Authorization: Bearer <customer-jwt>
Content-Type: application/json

{
  "code": "GOLD10",
  "orderId": "cm789ghi",
  "userId": "cm456def",
  "subtotalInt": 100000000
}

Response 200:
{
  "success": true,
  "discountUsageId": "cm999xyz",
  "discountedInt": 10000000
}
```

**5. Update Code Status (Admin)**
```http
PATCH /api/promotions/codes/:id
Authorization: Bearer <admin-jwt>

{
  "isActive": false
}

Response 200:
{
  "id": "cm123abc",
  "code": "GOLD10",
  "isActive": false
}
```

**6. Delete Discount Code (Admin)**
```http
DELETE /api/promotions/codes/:id
Authorization: Bearer <admin-jwt>

Response 204 No Content
```

### Order Service - Integration Points

**Event: `order.completed`**
```typescript
// Published by Order Service when order status = COMPLETED
interface OrderCompletedEvent {
  orderId: string;
  userId: string;
  totalInt: number;
  completedAt: string;
}

// User Service subscribes to this event
// → Recalculate totalSpentInt
// → Update vipTier if threshold crossed
```

## Component Breakdown

### 1. Promotion Microservice (`apps/promotion-app/`)

**Structure**:
```
apps/promotion-app/
├── src/
│   ├── main.ts                      # Bootstrap
│   ├── promotion.module.ts          # Main module
│   ├── promotion.controller.ts      # NATS message handlers
│   ├── promotion.service.ts         # Business logic
│   ├── entities/
│   │   ├── discount-code.entity.ts
│   │   └── discount-usage.entity.ts
│   ├── dto/
│   │   ├── create-discount-code.dto.ts
│   │   ├── validate-discount.dto.ts
│   │   └── apply-discount.dto.ts
│   └── guards/
│       └── roles.guard.ts           # Admin role check
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── test/
```

**Key Classes**:

```typescript
// promotion.service.ts
@Injectable()
export class PromotionService {
  // Calculate discount amount based on code and subtotal
  async calculateDiscount(
    code: string,
    userId: string,
    subtotalInt: number,
  ): Promise<DiscountCalculation> {
    // 1. Find code by string
    // 2. Validate expiry, usage limits
    // 3. Check user's VIP tier
    // 4. Check minimum purchase
    // 5. Calculate discounted amount
  }
  
  // Apply discount to an order
  async applyDiscount(
    code: string,
    orderId: string,
    userId: string,
    subtotalInt: number,
  ): Promise<DiscountUsage> {
    // 1. Validate discount (call calculateDiscount)
    // 2. Create DiscountUsage record
    // 3. Increment usedCount
    // 4. Return usage record
  }
  
  // Admin: Create discount code
  async createCode(dto: CreateDiscountCodeDto): Promise<DiscountCode> {
    // Validate code uniqueness
    // Create in database
  }
  
  // Admin: List codes with pagination
  async listCodes(filters: ListCodesDto): Promise<PaginatedResponse<DiscountCode>> {
    // Query with filters: tier, status, search
  }
}
```

### 2. User Service - VIP Tier Logic

**New Methods in `user.service.ts`**:

```typescript
@Injectable()
export class UserService {
  // Calculate VIP tier based on total spending
  private calculateTierFromSpending(totalSpentInt: number): VipTier {
    if (totalSpentInt >= 5000000000) return VipTier.PLATINUM; // 50M VND
    if (totalSpentInt >= 3000000000) return VipTier.GOLD;     // 30M VND
    if (totalSpentInt >= 1500000000) return VipTier.SILVER;   // 15M VND
    if (totalSpentInt >= 500000000) return VipTier.BRONZE;    // 5M VND
    return VipTier.STANDARD;
  }
  
  // Recalculate tier after order completion
  async recalculateVipTier(userId: string): Promise<VipTierUpdate> {
    // 1. Get user's totalSpentInt from orders (via NATS to Order Service)
    // 2. Calculate new tier
    // 3. Compare with current tier
    // 4. Update if changed (unless vipTierOverride is set)
    // 5. Send email notification if tier changed
  }
  
  // Admin: Manually override tier
  async updateVipTier(
    userId: string,
    newTier: VipTier,
    reason: string,
    adminId: string,
  ): Promise<User> {
    // Set vipTier and vipTierOverride
    // Set tierReason
    // Send notification
  }
  
  // Get VIP info for frontend
  async getVipInfo(userId: string): Promise<VipInfo> {
    const user = await this.findById(userId);
    const discountRate = this.getDiscountRate(user.vipTier);
    const nextTier = this.getNextTier(user.vipTier, user.totalSpentInt);
    
    return {
      currentTier: user.vipTier,
      totalSpentInt: user.totalSpentInt,
      discountRate,
      nextTier,
    };
  }
}
```

### 3. Gateway - Route Mapping

**New Routes** in `apps/gateway/src/app.controller.ts`:

```typescript
// Promotion routes
@Get('/promotions/codes')
@UseGuards(AdminGuard)
listDiscountCodes(@Query() query) {
  return this.promotionService.send('promotion.listCodes', query);
}

@Post('/promotions/codes')
@UseGuards(AdminGuard)
createDiscountCode(@Body() dto, @User() admin) {
  return this.promotionService.send('promotion.createCode', { ...dto, createdBy: admin.id });
}

@Post('/promotions/codes/validate')
@UseGuards(AuthGuard)
validateDiscountCode(@Body() dto, @User() user) {
  return this.promotionService.send('promotion.validateCode', { ...dto, userId: user.id });
}

// VIP routes
@Get('/users/me/vip')
@UseGuards(AuthGuard)
getMyVipInfo(@User() user) {
  return this.userService.send('user.getVipInfo', { userId: user.id });
}

@Patch('/users/:id/vip-tier')
@UseGuards(AdminGuard)
updateVipTier(@Param('id') userId, @Body() dto, @User() admin) {
  return this.userService.send('user.updateVipTier', { userId, ...dto, adminId: admin.id });
}
```

## Design Decisions

### 1. New Microservice vs Extend User Service

**Decision**: Tạo `promotion-app` mới ✓

**Rationale**:
- Promotions có business logic phức tạp (validation, usage tracking)
- Có thể scale độc lập (high traffic khi có campaigns)
- Clear separation of concerns

**Trade-off**:
- Thêm service → thêm database, port, deployment
- Acceptable vì hệ thống đã microservices-based

### 2. VIP Tier Storage Location

**Decision**: Store `vipTier` trong User table ✓

**Rationale**:
- Frequently accessed với user info
- No need separate VipProfile table (premature optimization)

**Trade-off**:
- User table thêm columns → migration
- Acceptable vì columns ít, indexed

### 3. Discount Code Validation Strategy

**Decision**: Validate at apply time, not during cart updates ✓

**Rationale**:
- Avoid unnecessary API calls khi user typing code
- Only validate khi user clicks "Apply"

**Trade-off**:
- User có thể thấy error sau khi click
- Acceptable vì provide clear error messages

### 4. totalSpentInt Caching

**Decision**: Cache total spending trong User table ✓

**Rationale**:
- Tránh query lại Orders mỗi lần check tier
- Update async khi order.completed event

**Trade-off**:
- Eventual consistency: có thể lag vài giây
- Acceptable vì tier không cần real-time accuracy

## Non-Functional Requirements

### Performance
- Discount validation: < 50ms
- VIP tier calculation: < 100ms
- Admin list codes: < 200ms with pagination

### Scalability
- Promotion service có thể horizontal scale
- Database indexed trên `code`, `userId`, `requiredTier`

### Security
- Admin routes require ADMIN role
- Discount codes case-insensitive (uppercase before compare)
- Prevent timing attacks trong code validation

### Reliability
- Discount usage transactions: ACID guarantees
- Idempotency: applying same code to same order multiple times = noop

## Database Indexes

```sql
-- User Service
CREATE INDEX idx_user_vip_tier ON "User"(vipTier);
CREATE INDEX idx_user_total_spent ON "User"(totalSpentInt);

-- Promotion Service
CREATE UNIQUE INDEX idx_discount_code ON "DiscountCode"(code);
CREATE INDEX idx_discount_tier ON "DiscountCode"(requiredTier);
CREATE INDEX idx_discount_active ON "DiscountCode"(isActive);
CREATE INDEX idx_usage_user ON "DiscountUsage"(userId);
CREATE INDEX idx_usage_order ON "DiscountUsage"(orderId);
```

## Event Flow Examples

### Scenario 1: Order Completed → VIP Tier Update

```mermaid
sequenceDiagram
    participant Order as Order Service
    participant NATS
    participant User as User Service
    participant Email as Email Service
    
    Order->>NATS: Publish order.completed
    NATS->>User: Event received
    User->>User: Recalculate totalSpentInt
    User->>User: Check new tier
    alt Tier Changed
        User->>User: Update vipTier
        User->>Email: Send tier upgrade email
    end
```

### Scenario 2: Apply Discount Code

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Promo as Promotion Service
    participant User as User Service
    
    Client->>Gateway: POST /promotions/codes/validate
    Gateway->>Promo: promotion.validateCode
    Promo->>User: Get user VIP tier
    User-->>Promo: VipTier: GOLD
    Promo->>Promo: Validate code rules
    Promo-->>Gateway: DiscountCalculation
    Gateway-->>Client: {valid: true, discountedInt: 10000}
```

## Service Ports Summary

| Service     | Port | Database | Port |
| ----------- | ---- | -------- | ---- |
| Promotion   | 3008 | promo_db | 5440 |

**Updated docker-compose.yml**:
```yaml
services:
  promotion-app:
    build:
      context: .
      dockerfile: apps/promotion-app/Dockerfile
    ports:
      - "3008:3008"
    environment:
      DATABASE_URL: "postgresql://postgres:postgres@promo_db:5432/promotion_db"
      NATS_URL: "nats://nats:4222"
    depends_on:
      - promo_db
      - nats
  
  promo_db:
    image: postgres:16
    ports:
      - "5440:5432"
    environment:
      POSTGRES_DB: promotion_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
```

