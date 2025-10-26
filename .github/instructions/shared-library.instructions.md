---
applyTo: 'libs/shared/**/*.ts'
---

# Shared Library Instructions

## Purpose

`libs/shared` chứa code được share giữa tất cả services:

- DTOs (Data Transfer Objects)
- Types & Interfaces
- RPC Exceptions
- NATS Event definitions
- JWT utilities
- Test helpers
- Filters

## Structure

```
libs/shared/
├── dto/              # Shared DTOs
├── types/            # TypeScript types
├── exceptions/       # RPC exception classes
├── filters/          # Exception filters
├── jwt/              # JWT utilities
├── testing/          # Test helpers
└── events.ts         # NATS event patterns
```

## DTOs (`libs/shared/dto/`)

### Organization

Group DTOs by domain:

```
dto/
├── user/
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   └── index.ts
├── product/
│   ├── create-product.dto.ts
│   └── index.ts
└── index.ts  # Re-export all
```

### Naming Convention

Format: `<Action><Entity>Dto`

```typescript
CreateUserDto;
UpdateProductDto;
LoginDto;
RegisterDto;
```

### Validation Requirements

Tất cả DTOs PHẢI có validation decorators:

```typescript
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;
}
```

### Export Pattern

```typescript
// dto/user/index.ts
export * from './create-user.dto';
export * from './update-user.dto';

// dto/index.ts
export * from './user';
export * from './product';
export * from './auth';
```

## Types (`libs/shared/types/`)

### Type Definitions

```typescript
// User types
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
}

export interface UserPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Order types
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}
```

## Exceptions (`libs/shared/exceptions/`)

### Available Exceptions

```typescript
EntityNotFoundRpcException; // 404 - Resource not found
ValidationRpcException; // 400 - Validation failed
ConflictRpcException; // 409 - Resource conflict
UnauthorizedRpcException; // 401 - Authentication failed
ForbiddenRpcException; // 403 - Authorization failed
ServiceUnavailableRpcException; // 503 - External service down
InternalServerRpcException; // 500 - Unexpected error
```

### Usage

```typescript
import { EntityNotFoundRpcException } from '@shared/exceptions';

if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}
```

### Creating New Exceptions

Follow existing pattern:

```typescript
import { RpcException } from '@nestjs/microservices';

export class CustomRpcException extends RpcException {
  constructor(message: string, details?: any) {
    super({
      statusCode: 400,
      message,
      details,
    });
  }
}
```

## Events (`libs/shared/events.ts`)

### Event Naming Convention

Format: `<domain>.<action>`

```typescript
export const EVENTS = {
  USER: {
    FIND_ONE: 'user.findOne',
    FIND_BY_EMAIL: 'user.findByEmail',
    CREATE: 'user.create',
    UPDATE: 'user.update',
    DEACTIVATE: 'user.deactivate',
  },

  AUTH: {
    LOGIN: 'auth.login',
    REGISTER: 'auth.register',
    VERIFY_TOKEN: 'auth.verifyToken',
    REFRESH_TOKEN: 'auth.refreshToken',
  },

  PRODUCT: {
    FIND_ALL: 'product.findAll',
    FIND_ONE: 'product.findOne',
    CREATE: 'product.create',
    UPDATE: 'product.update',
    DELETE: 'product.delete',
  },

  // Add more domains...
};
```

### Adding New Events

1. Group by domain
2. Use camelCase for action
3. Maintain alphabetical order
4. Document complex events

```typescript
/**
 * Event: cart.checkout
 * Payload: { userId: string, cartId: string, addressId: string }
 * Returns: { orderId: string, total: number }
 */
CART: {
  CHECKOUT: 'cart.checkout',
}
```

## JWT Utilities (`libs/shared/jwt/`)

### JWT Service

Provides token generation and verification:

```typescript
import { JwtService } from '@shared/jwt/jwt.service';

// Generate token (in auth service)
const token = await this.jwtService.generateToken({
  sub: user.id,
  email: user.email,
  role: user.role,
});

// Verify token (in Gateway's AuthGuard)
const payload = await this.jwtService.verifyToken(token);
```

### Key Management

- Private key: Sign tokens (trong auth service)
- Public key: Verify tokens (trong Gateway)
- Keys stored in `keys/` directory
- Load keys từ environment variables

## Testing Helpers (`libs/shared/testing/`)

### RPC Test Helpers

```typescript
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

// Check error message
await expectRpcError(promise, 'expected error message substring');

// Check status code and message
await expectRpcErrorWithStatus(promise, 404, 'User không tồn tại');
```

## Import Aliases

Code ngoài `libs/shared` import với `@shared/`:

```typescript
// ✅ CORRECT
import { CreateUserDto, UpdateUserDto } from '@shared/dto';
import { EVENTS } from '@shared/events';
import { EntityNotFoundRpcException } from '@shared/exceptions';
import { UserRole } from '@shared/types';

// ❌ WRONG
import { CreateUserDto } from '../../../libs/shared/dto/user/create-user.dto';
```

## Best Practices

1. **Keep it Generic**: Shared code phải generic, không business-logic specific
2. **No Dependencies on Apps**: Shared library KHÔNG import từ `apps/*`
3. **Backward Compatible**: Changes phải backward compatible hoặc migrate all usages
4. **Well Documented**: Complex utilities cần có JSDoc
5. **Tested**: Test shared utilities thoroughly
6. **Typed**: Strong typing, no `any`

## Adding New Shared Code

Checklist:

- [ ] Đặt trong folder phù hợp (`dto/`, `types/`, etc.)
- [ ] Follow naming conventions
- [ ] Add exports trong `index.ts`
- [ ] Write tests nếu là logic phức tạp
- [ ] Document nếu là API public
- [ ] Update imports trong services sử dụng

## Versioning

Khi breaking changes trong shared library:

1. Update tất cả services cùng lúc
2. Test thoroughly với all services
3. Deploy coordinated release
4. Document migration path
