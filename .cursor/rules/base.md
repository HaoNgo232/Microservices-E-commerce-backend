# Cursor AI Rules - E-commerce Microservices Platform

## 🎯 Project Overview

**Tech Stack**: NestJS + NATS + PostgreSQL + Prisma  
**Architecture**: Microservices (Gateway + 7 services)  
**Auth**: RSA-based JWT (Perimeter Security)  
**Package Manager**: pnpm

## 📂 Project Structure

```
apps/
├── gateway/          # API Gateway (REST) - Port 3000
├── user-app/         # User service - Port 3001
├── product-app/      # Product service - Port 3002
├── cart-app/         # Cart service - Port 3003
├── order-app/        # Order service - Port 3004
├── payment-app/      # Payment service - Port 3005
├── ar-app/          # AR service - Port 3006
└── report-app/       # Report service - Port 3007

libs/shared/          # Shared library
├── dto/             # Data Transfer Objects
├── types/           # TypeScript types
├── exceptions/      # RPC exceptions
└── events.ts        # NATS event patterns
```

## 🔑 Key Conventions

### 1. Communication Pattern

- **Client → Gateway**: HTTP REST
- **Gateway → Services**: NATS message queue
- **Services → Services**: NATS (nếu cần)

### 2. Authentication Flow

```
Client → Gateway (JWT verify) → NATS (userId in payload) → Microservice (trust Gateway)
```

### 3. Database Pattern

- Mỗi service có **database riêng**
- Không share database giữa services
- Database ports: 5433-5439

### 4. Naming Conventions

**NATS Events**: `<domain>.<action>`

```typescript
EVENTS.USER.FIND_ONE = 'user.findOne';
EVENTS.PRODUCT.CREATE = 'product.create';
```

**DTOs**: `<Action><Entity>Dto`

```typescript
(CreateUserDto, UpdateProductDto, LoginDto);
```

**RPC Exceptions**:

```typescript
EntityNotFoundRpcException; // 404
ValidationRpcException; // 400
ConflictRpcException; // 409
UnauthorizedRpcException; // 401
ForbiddenRpcException; // 403
ServiceUnavailableRpcException; // 503
InternalServerRpcException; // 500
```

## ✅ Code Quality Rules

### 1. Always Use Explicit Prisma Select

```typescript
// ✅ ĐÚNG
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    // ❌ NEVER select passwordHash
  },
});

// ❌ SAI
const user = await prisma.user.findUnique({ where: { id } });
```

### 2. NATS Communication Must Have Timeout & Retry

```typescript
// ✅ ĐÚNG
return firstValueFrom(
  this.userClient.send(EVENTS.USER.FIND_ONE, { userId }).pipe(timeout(5000), retry({ count: 1, delay: 1000 })),
);

// ❌ SAI
return firstValueFrom(this.userClient.send(EVENTS.USER.FIND_ONE, { userId }));
```

### 3. DTOs Must Have Validation

```typescript
// ✅ ĐÚNG
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// ❌ SAI
export class CreateUserDto {
  email: string;
  password: string;
}
```

### 4. Controllers in Microservices: No Guards

```typescript
// ✅ ĐÚNG - Microservice controller
@Controller()
export class UsersController {
  @MessagePattern(EVENTS.USER.FIND_ONE)
  async findOne(@Payload() payload: { userId: string }) {
    return this.usersService.findOne(payload.userId);
  }
}

// ✅ ĐÚNG - Gateway controller
@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(AuthGuard) // Gateway có guard
  async getProfile(@Request() req) {
    return this.userClient.send(EVENTS.USER.FIND_ONE, { userId: req.user.userId });
  }
}
```

### 5. Error Handling

```typescript
// ✅ ĐÚNG
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}

if (existingEmail) {
  throw new ConflictRpcException('Email đã được sử dụng');
}

// ❌ SAI
throw new Error('User not found');
throw new RpcException('Email exists');
```

## 🧪 Testing Requirements

### Unit Tests

- File name: `*.spec.ts` (cùng thư mục với source file)
- Mock Prisma service
- Target: 80%+ coverage

### E2E Tests

- File name: `*.e2e-spec.ts` (trong `apps/*/test/`)
- Use real NATS & database (test environment)
- Test full flow

```typescript
// Test helper
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

await expectRpcErrorWithStatus(firstValueFrom(client.send(EVENTS.USER.FIND_ONE, 'invalid-id')), 404, 'không tồn tại');
```

## 📝 Common Tasks

### Add New Feature

1. Update Prisma schema → `pnpm db:migrate:all`
2. Create DTOs in `libs/shared/dto/`
3. Implement service logic
4. Create controller (microservice)
5. Update gateway controller
6. Write tests (unit + E2E)
7. Create HTTP test file in `http/`

### Database Changes

```bash
# Edit schema
vim apps/user-app/prisma/schema.prisma

# Generate client
pnpm db:gen:all

# Create migration
cd apps/user-app
npx prisma migrate dev --name <migration_name>
```

### Run Services

```bash
# All services
pnpm dev:all

# Single service
pnpm nest start --watch user-app
pnpm nest start --watch gateway

# Tests
pnpm test           # Unit tests
pnpm test:e2e       # E2E tests
pnpm test:full      # Full test suite with Docker
```

## 🚫 Common Mistakes to Avoid

### ❌ DON'T

1. Share database between services
2. Put guards in microservice controllers
3. Use `findUnique()` without select
4. NATS send without timeout
5. Expose passwordHash in responses
6. Use generic error messages
7. Skip input validation
8. Commit without tests

### ✅ DO

1. Each service has own database
2. Only Gateway has guards
3. Always explicit Prisma select
4. NATS with timeout & retry
5. Exclude sensitive fields
6. Use specific RPC exceptions
7. Validate all DTOs
8. Write tests for new features

## 📚 Documentation

**Đọc trước khi code:**

- `docs/AI-ASSISTANT-GUIDE.md` - Hướng dẫn toàn diện
- `docs/architecture/SECURITY-ARCHITECTURE.md` - Security model
- `docs/knowledge/RPC-EXCEPTIONS-GUIDE.md` - Exception handling
- `SETUP.md` - Setup instructions

**Feature development:**

- Check `docs/ai/requirements/` for feature specs
- Check `docs/ai/design/` for design patterns
- Check `http/` for API examples

## 🔍 Debugging

```bash
# Check services
docker compose ps

# View logs
docker compose logs -f
docker compose logs <service_name>

# NATS monitoring
curl http://localhost:8222/varz

# Database access
psql -h localhost -p 5433 -U user -d user_db

# Prisma Studio
npx prisma studio --schema=apps/user-app/prisma/schema.prisma
```

## 🎨 Code Style

- Use **TypeScript** strictly (no `any`)
- Use **async/await** over callbacks
- Use **firstValueFrom** for NATS observables
- Import từ `@shared/...` cho shared code
- Follow NestJS conventions (modules, services, controllers)
- Use Prisma transactions cho multi-step operations

## 🔐 Security Checklist

- [ ] JWT verified tại Gateway
- [ ] Sensitive data không expose (passwordHash, etc.)
- [ ] Input validation với class-validator
- [ ] Password hash với bcrypt
- [ ] HTTPS trong production
- [ ] Rate limiting (production)
- [ ] SQL injection protected (Prisma)

---

**Important**: Luôn đọc `docs/AI-ASSISTANT-GUIDE.md` để hiểu chi tiết project structure, patterns và workflows.
