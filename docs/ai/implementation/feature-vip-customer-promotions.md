---
phase: implementation
title: VIP Customer Management & Promotions - Backend Implementation
description: Technical implementation details, code patterns, và best practices
---

# Implementation Guide - Backend

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 16+
- Docker & Docker Compose
- NATS server (via Docker)

### Environment Setup

```bash
# Clone and install
cd backend-luan-van
pnpm install

# Start infrastructure
docker-compose up -d

# Create new database for Promotion Service
docker exec -it postgres psql -U postgres -c "CREATE DATABASE promotion_db;"

# Run migrations
cd apps/user-app && npx prisma migrate dev
cd apps/promotion-app && npx prisma migrate dev

# Seed data
pnpm run seed
```

### Configuration Files

**`.env` (root)**:

```env
# Promotion Service
PROMOTION_DATABASE_URL="postgresql://postgres:postgres@localhost:5440/promotion_db"

# Existing services
USER_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/user_db"
ORDER_DATABASE_URL="postgresql://postgres:postgres@localhost:5436/order_db"

# NATS
NATS_URL="nats://localhost:4222"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
```

**`docker-compose.yml` (extended)**:

```yaml
services:
  # ... existing services ...

  promotion-app:
    build:
      context: .
      dockerfile: apps/promotion-app/Dockerfile
    ports:
      - '3008:3008'
    environment:
      DATABASE_URL: 'postgresql://postgres:postgres@promo_db:5432/promotion_db'
      NATS_URL: 'nats://nats:4222'
      PORT: 3008
    depends_on:
      - promo_db
      - nats
    networks:
      - backend-network

  promo_db:
    image: postgres:16-alpine
    container_name: promo_db
    ports:
      - '5440:5432'
    environment:
      POSTGRES_DB: promotion_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - promo_db_data:/var/lib/postgresql/data
    networks:
      - backend-network

volumes:
  promo_db_data:
```

## Code Structure

### Promotion Microservice Structure

```
apps/promotion-app/
├── src/
│   ├── main.ts                         # Bootstrap
│   ├── promotion.module.ts             # Main module
│   ├── promotion.controller.ts         # NATS handlers
│   ├── promotion.service.ts            # Business logic
│   ├── entities/
│   │   ├── discount-code.entity.ts
│   │   └── discount-usage.entity.ts
│   ├── dto/
│   │   ├── create-discount-code.dto.ts
│   │   ├── update-discount-code.dto.ts
│   │   ├── validate-discount.dto.ts
│   │   ├── apply-discount.dto.ts
│   │   └── list-codes.dto.ts
│   ├── guards/
│   │   └── roles.guard.ts
│   └── utils/
│       ├── discount-calculator.ts
│       └── tier-validator.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── test/
│   ├── promotion.service.spec.ts
│   └── promotion.e2e-spec.ts
├── Dockerfile
└── tsconfig.app.json
```

### Shared Library Structure

```
libs/shared/
├── dto/
│   └── promotion/
│       ├── create-discount-code.dto.ts
│       ├── validate-discount.dto.ts
│       ├── apply-discount.dto.ts
│       └── update-vip-tier.dto.ts
├── types/
│   └── promotion.types.ts
├── events.ts                           # Add promotion events
└── ...
```

## Implementation Notes

### Core Features

#### 1. VIP Tier Calculation (User Service)

**File**: `apps/user-app/src/user.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { VipTier } from '@shared/types';

@Injectable()
export class UserService {
  // VIP tier thresholds (in cents)
  private readonly VIP_THRESHOLDS = {
    [VipTier.BRONZE]: 500_000_000, // 5M VND
    [VipTier.SILVER]: 1_500_000_000, // 15M VND
    [VipTier.GOLD]: 3_000_000_000, // 30M VND
    [VipTier.PLATINUM]: 5_000_000_000, // 50M VND
  };

  /**
   * Calculate VIP tier based on total spending
   */
  private calculateTierFromSpending(totalSpentInt: number): VipTier {
    if (totalSpentInt >= this.VIP_THRESHOLDS[VipTier.PLATINUM]) {
      return VipTier.PLATINUM;
    }
    if (totalSpentInt >= this.VIP_THRESHOLDS[VipTier.GOLD]) {
      return VipTier.GOLD;
    }
    if (totalSpentInt >= this.VIP_THRESHOLDS[VipTier.SILVER]) {
      return VipTier.SILVER;
    }
    if (totalSpentInt >= this.VIP_THRESHOLDS[VipTier.BRONZE]) {
      return VipTier.BRONZE;
    }
    return VipTier.STANDARD;
  }

  /**
   * Recalculate user's VIP tier based on order history
   */
  async recalculateVipTier(userId: string): Promise<VipTierUpdate> {
    // 1. Get user
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 2. Get total spending from Order Service (via NATS)
    const totalSpentInt = await this.getTotalSpentFromOrders(userId);

    // 3. Calculate new tier
    const newTier = this.calculateTierFromSpending(totalSpentInt);
    const oldTier = user.vipTier || VipTier.STANDARD;

    // 4. Check if tier changed
    if (newTier === oldTier) {
      return { userId, oldTier, newTier, updated: false };
    }

    // 5. Update user (only if no manual override)
    if (!user.vipTierOverride) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          vipTier: newTier,
          totalSpentInt,
          tierUpdatedAt: new Date(),
        },
      });

      // 6. Send notification email
      await this.sendTierChangeEmail(user.email, oldTier, newTier);
    }

    return { userId, oldTier, newTier, updated: true };
  }

  /**
   * Get total spending from Order Service
   */
  private async getTotalSpentFromOrders(userId: string): Promise<number> {
    try {
      const response = await this.orderService.send(EVENTS.ORDER.GET_TOTAL_SPENT, { userId }).toPromise();
      return response.totalSpentInt || 0;
    } catch (error) {
      this.logger.error(`Failed to get total spent for user ${userId}`, error);
      return 0;
    }
  }

  /**
   * Admin: Manually update VIP tier
   */
  async updateVipTier(userId: string, newTier: VipTier, reason: string, adminId: string): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        vipTier: newTier,
        vipTierOverride: newTier,
        tierReason: reason,
        tierUpdatedAt: new Date(),
      },
    });

    // Log audit
    this.logger.log(`Admin ${adminId} updated user ${userId} VIP tier to ${newTier}. Reason: ${reason}`);

    // Send notification
    await this.sendTierChangeEmail(user.email, user.vipTier, newTier, true);

    return user;
  }

  /**
   * Get VIP info for frontend
   */
  async getVipInfo(userId: string): Promise<VipInfo> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const currentTier = user.vipTier || VipTier.STANDARD;
    const discountRate = this.getDiscountRate(currentTier);
    const nextTier = this.getNextTier(currentTier, user.totalSpentInt);

    return {
      userId: user.id,
      currentTier,
      totalSpentInt: user.totalSpentInt,
      discountRate,
      nextTier,
    };
  }

  private getDiscountRate(tier: VipTier): number {
    const rates = {
      [VipTier.STANDARD]: 0,
      [VipTier.BRONZE]: 0.05,
      [VipTier.SILVER]: 0.1,
      [VipTier.GOLD]: 0.15,
      [VipTier.PLATINUM]: 0.2,
    };
    return rates[tier] || 0;
  }

  private getNextTier(currentTier: VipTier, totalSpentInt: number) {
    const tiers = [VipTier.STANDARD, VipTier.BRONZE, VipTier.SILVER, VipTier.GOLD, VipTier.PLATINUM];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex === tiers.length - 1) return null; // Already max tier

    const nextTier = tiers[currentIndex + 1];
    const requiredSpending = this.VIP_THRESHOLDS[nextTier];
    const remaining = requiredSpending - totalSpentInt;

    return { tier: nextTier, requiredSpending, remaining };
  }
}
```

**Subscribe to Order Events**:

```typescript
// apps/user-app/src/user.controller.ts

@Controller()
export class UserController {
  @EventPattern(EVENTS.ORDER.COMPLETED)
  async handleOrderCompleted(data: OrderCompletedEvent) {
    this.logger.log(`Order ${data.orderId} completed for user ${data.userId}`);
    await this.userService.recalculateVipTier(data.userId);
  }
}
```

#### 2. Discount Code Validation (Promotion Service)

**File**: `apps/promotion-app/src/promotion.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { VipTier, DiscountType } from '@shared/types';

@Injectable()
export class PromotionService {
  /**
   * Validate discount code and calculate discount
   */
  async validateDiscountCode(code: string, userId: string, subtotalInt: number): Promise<DiscountValidation> {
    // 1. Find code
    const discountCode = await this.prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!discountCode) {
      return { valid: false, error: 'CODE_NOT_FOUND' };
    }

    // 2. Check if active
    if (!discountCode.isActive) {
      return { valid: false, error: 'CODE_INACTIVE' };
    }

    // 3. Check expiry
    if (discountCode.expiresAt && new Date() > discountCode.expiresAt) {
      return { valid: false, error: 'CODE_EXPIRED' };
    }

    // 4. Check start date
    if (discountCode.startsAt && new Date() < discountCode.startsAt) {
      return { valid: false, error: 'CODE_NOT_STARTED' };
    }

    // 5. Check max usages
    if (discountCode.maxUsages && discountCode.usedCount >= discountCode.maxUsages) {
      return { valid: false, error: 'MAX_USAGE_REACHED' };
    }

    // 6. Check user VIP tier
    if (discountCode.requiredTier) {
      const userTier = await this.getUserVipTier(userId);
      if (!this.isTierEligible(userTier, discountCode.requiredTier)) {
        return { valid: false, error: 'TIER_NOT_MET' };
      }
    }

    // 7. Check minimum purchase
    if (discountCode.minPurchaseInt && subtotalInt < discountCode.minPurchaseInt) {
      return { valid: false, error: 'MIN_PURCHASE_NOT_MET' };
    }

    // 8. Check usage per user
    if (discountCode.maxUsagePerUser) {
      const userUsageCount = await this.prisma.discountUsage.count({
        where: {
          discountCodeId: discountCode.id,
          userId,
        },
      });
      if (userUsageCount >= discountCode.maxUsagePerUser) {
        return { valid: false, error: 'USER_MAX_USAGE_REACHED' };
      }
    }

    // 9. Calculate discount amount
    const discountedInt = this.calculateDiscountAmount(discountCode.type, discountCode.value, subtotalInt);

    const finalTotalInt = Math.max(0, subtotalInt - discountedInt);

    return {
      valid: true,
      discountCode,
      discountedInt,
      finalTotalInt,
      error: null,
    };
  }

  /**
   * Apply discount code to order
   */
  async applyDiscountCode(code: string, orderId: string, userId: string, subtotalInt: number): Promise<DiscountUsage> {
    // 1. Validate code
    const validation = await this.validateDiscountCode(code, userId, subtotalInt);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // 2. Check idempotency: already applied to this order?
    const existing = await this.prisma.discountUsage.findUnique({
      where: { orderId },
    });
    if (existing) {
      return existing; // Already applied, return existing
    }

    // 3. Create usage record + increment usedCount (transaction)
    return await this.prisma.$transaction(async tx => {
      const usage = await tx.discountUsage.create({
        data: {
          discountCodeId: validation.discountCode.id,
          orderId,
          userId,
          discountedInt: validation.discountedInt,
        },
      });

      await tx.discountCode.update({
        where: { id: validation.discountCode.id },
        data: { usedCount: { increment: 1 } },
      });

      return usage;
    });
  }

  private calculateDiscountAmount(type: DiscountType, value: number, subtotalInt: number): number {
    if (type === DiscountType.PERCENTAGE) {
      return Math.floor((subtotalInt * value) / 100);
    }
    if (type === DiscountType.FIXED_AMOUNT) {
      return Math.min(value, subtotalInt); // Don't exceed subtotal
    }
    return 0;
  }

  private async getUserVipTier(userId: string): Promise<VipTier> {
    try {
      const response = await this.userService.send(EVENTS.USER.GET_VIP_INFO, { userId }).toPromise();
      return response.currentTier || VipTier.STANDARD;
    } catch (error) {
      this.logger.error(`Failed to get VIP tier for user ${userId}`, error);
      return VipTier.STANDARD;
    }
  }

  private isTierEligible(userTier: VipTier, requiredTier: VipTier): boolean {
    const tierOrder = [VipTier.STANDARD, VipTier.BRONZE, VipTier.SILVER, VipTier.GOLD, VipTier.PLATINUM];
    const userTierIndex = tierOrder.indexOf(userTier);
    const requiredTierIndex = tierOrder.indexOf(requiredTier);
    return userTierIndex >= requiredTierIndex;
  }
}
```

#### 3. Admin CRUD Operations (Promotion Service)

```typescript
// apps/promotion-app/src/promotion.service.ts

@Injectable()
export class PromotionService {
  /**
   * Admin: Create discount code
   */
  async createDiscountCode(dto: CreateDiscountCodeDto): Promise<DiscountCode> {
    return this.prisma.discountCode.create({
      data: {
        code: dto.code.toUpperCase(),
        description: dto.description,
        type: dto.type,
        value: dto.value,
        requiredTier: dto.requiredTier,
        maxUsages: dto.maxUsages,
        maxUsagePerUser: dto.maxUsagePerUser,
        startsAt: dto.startsAt,
        expiresAt: dto.expiresAt,
        minPurchaseInt: dto.minPurchaseInt,
        isActive: true,
        createdBy: dto.createdBy,
      },
    });
  }

  /**
   * Admin: List discount codes with pagination
   */
  async listDiscountCodes(filters: ListCodesDto): Promise<PaginatedResponse<DiscountCode>> {
    const { page = 1, limit = 20, tier, status, search } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.DiscountCodeWhereInput = {};

    if (tier) where.requiredTier = tier;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.discountCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.discountCode.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Admin: Update discount code
   */
  async updateDiscountCode(id: string, updates: Partial<UpdateDiscountCodeDto>): Promise<DiscountCode> {
    return this.prisma.discountCode.update({
      where: { id },
      data: updates,
    });
  }

  /**
   * Admin: Delete discount code
   */
  async deleteDiscountCode(id: string): Promise<void> {
    await this.prisma.discountCode.delete({ where: { id } });
  }
}
```

### Patterns & Best Practices

#### 1. Error Handling Strategy

```typescript
// Custom exceptions
export class DiscountCodeNotFoundExceptionextends NotFoundException {
  constructor(code: string) {
    super(`Discount code '${code}' not found`);
  }
}

export class DiscountCodeExpiredException extends BadRequestException {
  constructor(code: string) {
    super(`Discount code '${code}' has expired`);
  }
}

// Usage in service
if (!discountCode) {
  throw new DiscountCodeNotFoundException(code);
}
```

#### 2. Validation with class-validator

```typescript
// libs/shared/dto/promotion/create-discount-code.dto.ts

import { IsString, IsEnum, IsInt, Min, Max, IsOptional, IsDate, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { VipTier, DiscountType } from '@shared/types';

export class CreateDiscountCodeDto {
  @IsString()
  @Matches(/^[A-Z0-9]+$/, { message: 'Code must contain only uppercase letters and numbers' })
  @Length(3, 20)
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsInt()
  @Min(1)
  @Max(100, { message: 'Percentage cannot exceed 100' })
  value: number;

  @IsOptional()
  @IsEnum(VipTier)
  requiredTier?: VipTier;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsages?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsagePerUser?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startsAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  minPurchaseInt?: number;

  @IsString()
  createdBy: string; // Admin user ID
}
```

#### 3. Logging Best Practices

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  async applyDiscountCode(...) {
    this.logger.log(`Applying discount code ${code} to order ${orderId}`);

    try {
      // ... logic ...
      this.logger.log(`Successfully applied discount code ${code}`);
    } catch (error) {
      this.logger.error(
        `Failed to apply discount code ${code}`,
        error.stack,
      );
      throw error;
    }
  }
}
```

## Integration Points

### Gateway → Promotion Service

```typescript
// apps/gateway/src/app.controller.ts

@Controller('/api/promotions')
export class AppController {
  constructor(@Inject('PROMOTION_SERVICE') private promotionService: ClientProxy) {}

  @Post('/codes')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createDiscountCode(@Body() dto: CreateDiscountCodeDto, @User() admin) {
    return this.promotionService.send(EVENTS.PROMOTION.CREATE_CODE, {
      ...dto,
      createdBy: admin.id,
    });
  }

  @Post('/codes/validate')
  @UseGuards(AuthGuard)
  async validateDiscountCode(@Body() dto: ValidateDiscountDto, @User() user) {
    return this.promotionService.send(EVENTS.PROMOTION.VALIDATE_CODE, {
      ...dto,
      userId: user.id,
    });
  }
}
```

### Order Service → User Service Event

```typescript
// apps/order-app/src/order.service.ts

async updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await this.prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  // Publish event if order completed
  if (status === OrderStatus.COMPLETED) {
    await this.natsClient.emit(EVENTS.ORDER.COMPLETED, {
      orderId: order.id,
      userId: order.userId,
      totalInt: order.totalInt,
      completedAt: new Date().toISOString(),
    });
  }

  return order;
}
```

## Error Handling

### Centralized Error Filter

```typescript
// apps/promotion-app/src/filters/http-exception.filter.ts

import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      statusCode: status,
      message: exceptionResponse['message'] || exception.message,
      error: exceptionResponse['error'] || 'Error',
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Performance Considerations

### 1. Database Indexing

```sql
-- Promotion Service
CREATE INDEX idx_discount_code_upper ON "DiscountCode"(UPPER(code));
CREATE INDEX idx_discount_code_active ON "DiscountCode"(isActive);
CREATE INDEX idx_discount_code_tier ON "DiscountCode"(requiredTier);
CREATE INDEX idx_discount_code_expiry ON "DiscountCode"(expiresAt);
CREATE INDEX idx_discount_usage_user ON "DiscountUsage"(userId);
CREATE INDEX idx_discount_usage_order ON "DiscountUsage"(orderId) UNIQUE;

-- User Service
CREATE INDEX idx_user_vip_tier ON "User"(vipTier);
CREATE INDEX idx_user_total_spent ON "User"(totalSpentInt);
```

### 2. Caching Strategy

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PromotionService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getDiscountCode(code: string): Promise<DiscountCode> {
    const cacheKey = `discount:${code}`;

    // Try cache first
    const cached = await this.cacheManager.get<DiscountCode>(cacheKey);
    if (cached) return cached;

    // Query database
    const discountCode = await this.prisma.discountCode.findUnique({
      where: { code },
    });

    // Cache for 5 minutes
    if (discountCode) {
      await this.cacheManager.set(cacheKey, discountCode, 300_000);
    }

    return discountCode;
  }
}
```

## Security Notes

### 1. Admin-Only Routes Protection

```typescript
// apps/promotion-app/src/guards/roles.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const { user } = context.switchToRpc().getData();
    return requiredRoles.includes(user.role);
  }
}
```

### 2. Input Sanitization

```typescript
// Always uppercase discount codes
code: dto.code.toUpperCase().trim();

// Validate code format (alphanumeric only)
@Matches(/^[A-Z0-9]+$/)
code: string;
```

### 3. SQL Injection Prevention

Prisma automatically prevents SQL injection via parameterized queries. Always use Prisma query builder:

```typescript
//  SAFE
await this.prisma.discountCode.findUnique({ where: { code } });

//  UNSAFE (don't do this)
await this.prisma.$queryRaw`SELECT * FROM "DiscountCode" WHERE code = '${code}'`;
```

## Testing Strategy

See `docs/ai/testing/feature-vip-customer-promotions.md` for comprehensive testing guide.

**Quick Start**:

```bash
# Unit tests
pnpm test apps/promotion-app

# E2E tests
pnpm test:e2e apps/gateway

# Coverage
pnpm test:cov apps/promotion-app
```
