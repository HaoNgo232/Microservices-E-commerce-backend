# E-commerce Microservices Platform - GitHub Copilot Instructions

## Project Overview

Đây là hệ thống E-commerce sử dụng kiến trúc microservices được xây dựng với NestJS, NATS message broker, PostgreSQL và Prisma ORM. Hệ thống bao gồm 1 API Gateway và 7 microservices độc lập, mỗi service có database riêng.

**Mục đích**: Luận văn tốt nghiệp về kiến trúc microservices trong thương mại điện tử.

**Phạm vi**: Development/Academic project với focus vào microservices patterns, NATS communication, và Perimeter Security model.

## Architecture

**Pattern**: API Gateway + Microservices + NATS Message Broker

```
Client → Gateway (HTTP/REST) → NATS → Microservices → PostgreSQL
```

**Security Model**: Perimeter Security

- Gateway verify JWT và attach userId vào NATS message
- Microservices tin tưởng messages từ Gateway (no guards trong microservices)
- Chỉ Gateway có AuthGuard

## Folder Structure

```
apps/                    # Microservices applications
├── gateway/            # API Gateway (REST) - Port 3000
├── user-app/           # User service - Port 3001
├── product-app/        # Product service - Port 3002
├── cart-app/           # Shopping cart - Port 3003
├── order-app/          # Order processing - Port 3004
├── payment-app/        # Payment processing - Port 3005
├── ar-app/             # AR features - Port 3006
└── report-app/         # Analytics - Port 3007

libs/shared/            # Shared libraries
├── dto/               # Data Transfer Objects
├── types/             # TypeScript types
├── exceptions/        # Custom RPC exceptions
├── filters/           # Exception filters
├── jwt/               # JWT utilities
└── events.ts          # NATS event patterns

docs/                   # Documentation
├── AI-ASSISTANT-GUIDE.md  # Comprehensive guide
├── QUICK-REFERENCE.md     # Quick reference
├── architecture/          # Architecture docs
└── knowledge/             # Knowledge base

http/                   # HTTP test files (.http)
scripts/                # Utility scripts
```

## Tech Stack & Libraries

- **Runtime**: Node.js v20+
- **Framework**: NestJS v11 (TypeScript-based)
- **Message Queue**: NATS v2.29
- **Database**: PostgreSQL 16 (mỗi service có DB riêng)
- **ORM**: Prisma v6
- **Authentication**: jose (RSA-based JWT)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest v30
- **Package Manager**: pnpm (KHÔNG dùng npm/yarn)
- **Containerization**: Docker Compose

## Database Architecture

**CRITICAL**: Mỗi microservice có database hoàn toàn riêng biệt. KHÔNG BAO GIỜ share database giữa các services.

```
user-app    → user_db (port 5433)
product-app → product_db (port 5434)
cart-app    → cart_db (port 5435)
order-app   → order_db (port 5436)
payment-app → payment_db (port 5437)
ar-app      → ar_db (port 5438)
report-app  → report_db (port 5439)
```

## Coding Standards & Conventions

### NestJS Module Structure

- Mỗi feature có module riêng với controller, service, và DTOs
- Controllers trong microservices dùng `@MessagePattern` (NATS)
- Controllers trong Gateway dùng REST decorators (`@Get`, `@Post`, etc.)

### NATS Event Naming

Format: `<domain>.<action>`

```typescript
EVENTS.USER.FIND_ONE = 'user.findOne';
EVENTS.PRODUCT.CREATE = 'product.create';
EVENTS.ORDER.UPDATE_STATUS = 'order.updateStatus';
```

### DTO Naming

Format: `<Action><Entity>Dto`

```typescript
(CreateUserDto, UpdateProductDto, LoginDto, RegisterDto);
```

### Prisma Queries

**LUÔN LUÔN** dùng explicit select để tránh leak sensitive data:

```typescript
//  CORRECT
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    firstName: true,
    // NEVER select passwordHash
  },
});

//  WRONG - exposes all fields including passwordHash
const user = await prisma.user.findUnique({ where: { id } });
```

### NATS Communication Pattern

Gateway gọi microservices PHẢI có timeout và retry:

```typescript
//  CORRECT
return firstValueFrom(
  this.userClient.send(EVENTS.USER.FIND_ONE, { userId }).pipe(timeout(5000), retry({ count: 1, delay: 1000 })),
);

//  WRONG - no error handling
return firstValueFrom(this.userClient.send(EVENTS.USER.FIND_ONE, { userId }));
```

### Error Handling

Dùng RPC exceptions từ `@shared/exceptions`:

```typescript
// Import
import {
  EntityNotFoundRpcException, // 404
  ValidationRpcException, // 400
  ConflictRpcException, // 409
  UnauthorizedRpcException, // 401
  ForbiddenRpcException, // 403
  ServiceUnavailableRpcException, // 503
  InternalServerRpcException, // 500
} from '@shared/exceptions';

// Usage
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}

if (existingEmail) {
  throw new ConflictRpcException('Email đã được sử dụng');
}
```

### DTO Validation

Tất cả DTOs PHẢI có validation decorators:

```typescript
//  CORRECT
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}

//  WRONG - no validation
export class CreateUserDto {
  email: string;
  password: string;
}
```

### Guards & Authentication

**CRITICAL RULE**:

- Gateway controllers: CÓ `@UseGuards(AuthGuard)`
- Microservice controllers: KHÔNG có guards (trust Gateway)

```typescript
//  CORRECT - Gateway controller
@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(AuthGuard) // Gateway verifies JWT
  async getProfile(@Request() req) {
    return this.userClient.send(EVENTS.USER.FIND_ONE, {
      userId: req.user.userId,
    });
  }
}

//  CORRECT - Microservice controller
@Controller()
export class UsersController {
  @MessagePattern(EVENTS.USER.FIND_ONE)
  async findOne(@Payload() payload: { userId: string }) {
    // No guards - trust Gateway
    return this.usersService.findOne(payload.userId);
  }
}
```

### TypeScript Standards

- Sử dụng TypeScript strict mode
- KHÔNG dùng `any` type
- Prefer `interface` cho data shapes, `type` cho unions
- Dùng `async/await` thay vì callbacks
- Import shared code từ `@shared/...`

### Code Style

- Use semicolons
- Single quotes for strings
- 2 spaces indentation
- Arrow functions cho callbacks
- Destructuring khi có thể
- Const > let, KHÔNG dùng var

## Testing Requirements

### Unit Tests

- File name: `*.spec.ts` (cùng thư mục với source)
- Mock Prisma service trong tests
- Target: 80%+ code coverage
- Test error cases và edge cases

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });
});
```

### E2E Tests

- File name: `*.e2e-spec.ts` trong `apps/*/test/`
- Dùng real NATS và test database
- Test full request-response flow
- Clean up test data sau mỗi test

### Test Helpers

Dùng helpers từ `@shared/testing/rpc-test-helpers`:

```typescript
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

await expectRpcErrorWithStatus(firstValueFrom(client.send(EVENTS.USER.FIND_ONE, 'invalid-id')), 404, 'không tồn tại');
```

## Commands to Use

### Development

```bash
pnpm dev:all                    # Start all services
pnpm nest start --watch gateway # Start single service
```

### Database

```bash
pnpm db:gen:all                 # Generate Prisma clients
pnpm db:migrate:all             # Run migrations
pnpm db:reset:all               # Reset all databases
```

### Testing

```bash
pnpm test                       # Unit tests
pnpm test:e2e                   # E2E tests
pnpm test:full                  # Full suite with Docker
```

### Build & Deploy

```bash
pnpm build:all                  # Build all services
pnpm lint                       # Check linting
pnpm format                     # Format code
```

## Important Files to Reference

Khi generate code hoặc giải thích concepts, tham khảo:

- `docs/AI-ASSISTANT-GUIDE.md` - Comprehensive development guide
- `docs/QUICK-REFERENCE.md` - Quick code snippets reference
- `docs/architecture/SECURITY-ARCHITECTURE.md` - Security model details
- `docs/knowledge/RPC-EXCEPTIONS-GUIDE.md` - Error handling guide
- `libs/shared/events.ts` - NATS event definitions
- `libs/shared/dto/` - Shared DTOs
- `libs/shared/exceptions/` - RPC exception classes

## Common Patterns

### Creating a New Feature

1. Update Prisma schema in appropriate service
2. Run `pnpm db:gen:all` và create migration
3. Create DTOs in `libs/shared/dto/`
4. Implement service logic với error handling
5. Create microservice controller với `@MessagePattern`
6. Update Gateway controller với REST endpoints và `@UseGuards(AuthGuard)`
7. Write unit tests và E2E tests
8. Create HTTP test file trong `http/`

### Database Migration Workflow

```bash
# 1. Edit schema
vim apps/user-app/prisma/schema.prisma

# 2. Generate client
pnpm db:gen:all

# 3. Create migration
cd apps/user-app
npx prisma migrate dev --name add_user_avatar_field
```

## Things to AVOID

KHÔNG share database giữa các services
KHÔNG dùng guards trong microservice controllers
KHÔNG dùng Prisma queries mà không có explicit select
KHÔNG gửi NATS messages mà không có timeout/retry
KHÔNG expose sensitive data như passwordHash trong responses
KHÔNG dùng generic error messages (dùng specific RPC exceptions)
KHÔNG skip DTO validation
KHÔNG commit code mà không có tests
KHÔNG dùng `npm` hay `yarn` - chỉ dùng `pnpm`

## Security Checklist

Khi generate authentication/authorization code:

- [ ] JWT được verify ở Gateway (không ở microservices)
- [ ] Sensitive fields (passwordHash) không được expose
- [ ] Input được validate với class-validator
- [ ] Passwords được hash với bcrypt (cost factor 10)
- [ ] NATS messages có timeout và error handling
- [ ] RPC exceptions phù hợp được sử dụng

## Documentation Standards

Khi generate code mới:

- Thêm JSDoc comments cho public methods
- Update relevant documentation files
- Create HTTP test examples trong `http/`
- Add tests với good coverage
- Follow existing code structure và naming

## Response Format Preferences

Khi generate code hoặc giải thích:

- Prioritize TypeScript với explicit types
- Show complete examples, không chỉ snippets
- Include imports và dependencies
- Explain trade-offs khi có multiple approaches
- Reference existing patterns trong codebase
- Đề xuất tests cho code mới
- Point to relevant documentation files

## Language

- Code comments: Tiếng Việt hoặc English (prefer English)
- Documentation: Tiếng Việt
- Variable/function names: English
- Error messages: Tiếng Việt (user-facing)
- Commit messages: English

---

**For more details, always reference**: `docs/AI-ASSISTANT-GUIDE.md`
