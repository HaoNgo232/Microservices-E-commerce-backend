# 🤖 AI Assistant Guide - E-commerce Microservices Platform

> **Hướng dẫn toàn diện cho AI assistants làm việc với project này**

## 📋 Mục Lục

1. [Tổng Quan Project](#1-tổng-quan-project)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Cấu Trúc Project](#3-cấu-trúc-project)
4. [Scripts & Commands](#4-scripts--commands)
5. [Development Workflow](#5-development-workflow)
6. [Testing Guidelines](#6-testing-guidelines)
7. [Coding Patterns & Best Practices](#7-coding-patterns--best-practices)
8. [Database Management](#8-database-management)
9. [Security Model](#9-security-model)
10. [Error Handling](#10-error-handling)
11. [NATS Communication](#11-nats-communication)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Tổng Quan Project

### Giới Thiệu

Đây là **hệ thống E-commerce** sử dụng kiến trúc **microservices** được xây dựng với:

- **Framework**: NestJS (Node.js)
- **Message Broker**: NATS
- **Database**: PostgreSQL (mỗi service có DB riêng)
- **ORM**: Prisma
- **Package Manager**: pnpm
- **Testing**: Jest
- **Authentication**: RSA-based JWT (asymmetric encryption)

### Các Microservices

| Service | Port | Database Port | Mô Tả |
|---------|------|---------------|-------|
| Gateway | 3000 | - | API Gateway (REST API, entry point) |
| User App | 3001 | 5433 | Quản lý users, authentication |
| Product App | 3002 | 5434 | Quản lý products, categories |
| Cart App | 3003 | 5435 | Shopping cart management |
| Order App | 3004 | 5436 | Order processing |
| Payment App | 3005 | 5437 | Payment processing |
| AR App | 3006 | 5438 | Augmented Reality features |
| Report App | 3007 | 5439 | Analytics & reports |
| NATS | 4222 | - | Message broker |
| NATS Monitor | 8222 | - | NATS monitoring UI |

### Tech Stack

```json
{
  "runtime": "Node.js v20+",
  "framework": "NestJS v11",
  "database": "PostgreSQL 16",
  "orm": "Prisma v6",
  "messageQueue": "NATS v2.29",
  "auth": "jose (JWT)",
  "validation": "class-validator",
  "testing": "Jest v30",
  "containerization": "Docker Compose"
}
```

---

## 2. Kiến Trúc Hệ Thống

### Architecture Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP (REST)
       │
┌──────▼──────────────────────┐
│  Gateway (API Gateway)      │
│  - REST endpoints           │
│  - JWT Authentication       │
│  - Request routing          │
└──────┬──────────────────────┘
       │ NATS (Message Queue)
       │
┌──────┴─────────────────────────────────┐
│                                         │
├─────────┬─────────┬─────────┬──────────┤
│         │         │         │          │
▼         ▼         ▼         ▼          ▼
User    Product   Cart    Order     Payment
App      App      App     App        App
│         │         │         │          │
▼         ▼         ▼         ▼          ▼
User    Product   Cart    Order     Payment
DB       DB       DB      DB         DB
(5433)  (5434)  (5435)  (5436)     (5437)
```

### Communication Flow

```typescript
// 1. Client gửi HTTP request
POST /auth/login
Headers: { "Content-Type": "application/json" }
Body: { email, password }

// 2. Gateway validate & forward qua NATS
gateway → NATS → user-app
Pattern: "auth.login"

// 3. User-app xử lý & response
user-app → NATS → gateway

// 4. Gateway trả về HTTP response
Response: { token, user }
```

### Database per Service Pattern

Mỗi microservice có **database riêng**, không share database:

```
✅ ĐÚNG:
user-app → user_db
product-app → product_db

❌ SAI:
user-app → shared_db ← product-app
```

**Lý do:**
- **Autonomy**: Service độc lập, không bị ảnh hưởng lẫn nhau
- **Scalability**: Scale database theo nhu cầu từng service
- **Fault Isolation**: Lỗi DB của service A không ảnh hưởng service B

---

## 3. Cấu Trúc Project

### Root Directory

```
backend-luan-van/
├── apps/                    # Các microservices
│   ├── gateway/            # API Gateway (REST)
│   ├── user-app/           # User service
│   ├── product-app/        # Product service
│   ├── cart-app/           # Cart service
│   ├── order-app/          # Order service
│   ├── payment-app/        # Payment service
│   ├── ar-app/             # AR service
│   └── report-app/         # Report service
├── libs/                    # Shared libraries
│   └── shared/
│       ├── dto/            # Data Transfer Objects
│       ├── types/          # TypeScript types
│       ├── exceptions/     # Custom exceptions
│       ├── filters/        # Exception filters
│       ├── jwt/            # JWT utilities
│       └── testing/        # Test helpers
├── docs/                    # Documentation
│   ├── ai/                 # AI-generated docs
│   ├── architecture/       # Architecture docs
│   └── knowledge/          # Knowledge base
├── http/                    # HTTP test files (.http)
├── scripts/                 # Utility scripts
│   ├── generate-keys.ts    # Generate RSA keys
│   └── db-init/            # Database init scripts
├── docker-compose.yml       # Docker services (dev)
├── docker-compose.test.yml  # Docker services (test)
├── package.json            # Dependencies & scripts
└── nest-cli.json           # NestJS monorepo config
```

### Cấu Trúc Một Microservice

```
apps/user-app/
├── prisma/
│   ├── schema.prisma       # Prisma schema
│   ├── migrations/         # Database migrations
│   ├── prisma.client.ts    # Prisma client wrapper
│   └── prisma.service.ts   # Prisma service
├── src/
│   ├── users/              # Users module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.service.spec.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   ├── auth/               # Auth module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.service.spec.ts
│   │   └── auth.module.ts
│   ├── user-app.module.ts  # Root module
│   └── main.ts             # Entry point
├── test/                    # E2E tests
│   └── users.e2e-spec.ts
└── tsconfig.app.json        # TypeScript config
```

### Shared Library (`libs/shared`)

```typescript
// Import từ shared library
import { EntityNotFoundRpcException } from '@shared/exceptions';
import { EVENTS } from '@shared/events';
import { CreateUserDto } from '@shared/dto';
import { UserRole } from '@shared/types';
```

**Lưu ý:** Tất cả DTOs, types, exceptions, utilities dùng chung đều nằm trong `libs/shared`

---

## 4. Scripts & Commands

### Setup & Installation

```bash
# Install dependencies
pnpm install

# Generate RSA keys (for JWT)
pnpm generate:keys

# Start Docker infrastructure
docker compose up -d

# Generate Prisma clients
pnpm db:gen:all

# Run migrations
pnpm db:migrate:all
```

### Development

```bash
# Start all services (development mode)
pnpm dev:all

# Start specific service
pnpm nest start --watch user-app
pnpm nest start --watch gateway

# Debug mode (with debugger)
pnpm start:debug:all

# Build all services
pnpm build:all

# Format code
pnpm format
pnpm format:check

# Lint code
pnpm lint
pnpm lint:check
```

### Database Management

```bash
# Generate Prisma clients (sau khi sửa schema)
pnpm db:gen:all

# Push schema to database (dev only, no migrations)
pnpm db:push:all

# Create & run migrations (recommended)
pnpm db:migrate:all

# Reset all databases (xóa data!)
pnpm db:reset:all

# Open Prisma Studio (GUI)
npx prisma studio --schema=apps/user-app/prisma/schema.prisma
```

### Testing

```bash
# Unit tests
pnpm test                    # Run all unit tests
pnpm test:watch              # Watch mode
pnpm test:cov                # With coverage

# E2E tests
pnpm test:e2e                # Run E2E tests
pnpm test:e2e:watch          # Watch mode

# Full E2E test suite (with Docker)
pnpm test:full               # Setup → Migrate → Test → Cleanup

# Manual E2E test steps
pnpm test:compose:up         # Start test containers
pnpm test:db:migrate         # Run migrations
pnpm test:run                # Run tests
pnpm test:compose:down       # Cleanup
```

### Docker Management

```bash
# Start all containers
docker compose up -d

# Stop all containers
docker compose down

# Stop and remove volumes (delete data)
docker compose down -v

# View logs
docker compose logs -f
docker compose logs user_db
docker compose logs nats

# Check status
docker compose ps

# Restart service
docker compose restart nats
```

### Production

```bash
# Build for production
pnpm build:all

# Run production build
pnpm start:prod:all

# Or run specific service
node dist/apps/gateway/main.js
```

---

## 5. Development Workflow

### Thêm Feature Mới

#### Bước 1: Planning

Đọc hoặc tạo file planning trong `docs/ai/planning/`:

```markdown
# Feature: User Profile Management

## Requirements
- User can view profile
- User can update profile
- Admin can view all profiles

## API Endpoints
- GET /users/me
- PUT /users/me
- GET /users (admin only)
```

#### Bước 2: Design

Tạo hoặc xem file design trong `docs/ai/design/`:

```markdown
# Design: User Profile Management

## Database Schema
```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  firstName   String?
  lastName    String?
  avatar      String?
  role        UserRole @default(CUSTOMER)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## DTOs
- UpdateProfileDto
- UserProfileResponseDto
```

#### Bước 3: Implementation

1. **Cập nhật Prisma Schema**:

```bash
# Edit schema
vim apps/user-app/prisma/schema.prisma

# Generate client
pnpm db:gen:all

# Create migration
cd apps/user-app
npx prisma migrate dev --name add_user_profile_fields
```

2. **Tạo DTOs** (trong `libs/shared/dto/`):

```typescript
// libs/shared/dto/user/update-profile.dto.ts
export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsUrl()
  @IsOptional()
  avatar?: string;
}
```

3. **Implement Service Logic**:

```typescript
// apps/user-app/src/users/users.service.ts
async updateProfile(userId: string, dto: UpdateProfileDto) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new EntityNotFoundRpcException('User', userId);
  }

  return this.prisma.user.update({
    where: { id: userId },
    data: dto,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      // NEVER select passwordHash!
    },
  });
}
```

4. **Implement Controller**:

```typescript
// apps/user-app/src/users/users.controller.ts
@MessagePattern(EVENTS.USER.UPDATE_PROFILE)
async updateProfile(@Payload() payload: { userId: string; data: UpdateProfileDto }) {
  return this.usersService.updateProfile(payload.userId, payload.data);
}
```

5. **Update Gateway**:

```typescript
// apps/gateway/src/users/users.controller.ts
@Put('me')
@UseGuards(AuthGuard)
async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
  return firstValueFrom(
    this.userClient.send(EVENTS.USER.UPDATE_PROFILE, {
      userId: req.user.userId,
      data: dto,
    }).pipe(
      timeout(5000),
      retry({ count: 1, delay: 1000 }),
    ),
  );
}
```

#### Bước 4: Testing

```typescript
// apps/user-app/src/users/users.service.spec.ts
describe('UsersService', () => {
  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const userId = 'test-user-id';
      const dto = { firstName: 'John', lastName: 'Doe' };

      const result = await service.updateProfile(userId, dto);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        service.updateProfile('invalid-id', {}),
      ).rejects.toThrow(EntityNotFoundRpcException);
    });
  });
});
```

#### Bước 5: Documentation

Tạo HTTP test file trong `http/`:

```http
### Update Profile
PUT http://localhost:3000/users/me
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe"
}
```

### Quy Trình Commit

```bash
# 1. Kiểm tra linter
pnpm lint:check

# 2. Run tests
pnpm test

# 3. Format code
pnpm format

# 4. Commit
git add .
git commit -m "feat(user): add user profile update"

# 5. Push
git push origin develop
```

---

## 6. Testing Guidelines

### Unit Testing

**Location**: Đặt cùng thư mục với file source (`*.spec.ts`)

```typescript
// apps/user-app/src/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('should throw EntityNotFoundRpcException', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('invalid')).rejects.toThrow(
        EntityNotFoundRpcException,
      );
    });
  });
});
```

### E2E Testing

**Location**: `apps/*/test/*.e2e-spec.ts`

```typescript
// apps/user-app/test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../src/prisma/prisma.service';
import { EVENTS } from '@shared/events';
import { firstValueFrom } from 'rxjs';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let client: ClientProxy;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [UserAppModule],
    }).compile();

    app = module.createNestApplication();
    const microservice = app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.NATS,
      options: { servers: [process.env.NATS_URL] },
    });

    await app.startAllMicroservices();
    await app.init();

    client = app.get('NATS_CLIENT');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('USER.FIND_ONE', () => {
    it('should return user by id', async () => {
      const user = await prisma.user.create({
        data: { email: 'test@example.com', passwordHash: 'hash' },
      });

      const result = await firstValueFrom(
        client.send(EVENTS.USER.FIND_ONE, { userId: user.id }),
      );

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        firstValueFrom(client.send(EVENTS.USER.FIND_ONE, { userId: 'invalid' })),
      ).rejects.toThrow();
    });
  });
});
```

### Test Helpers

```typescript
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

// Check error message
await expectRpcError(
  firstValueFrom(client.send(EVENTS.USER.FIND_ONE, 'invalid-id')),
  'không tồn tại',
);

// Check error message and status code
await expectRpcErrorWithStatus(
  firstValueFrom(client.send(EVENTS.USER.FIND_ONE, 'invalid-id')),
  404,
  'không tồn tại',
);
```

### Coverage

```bash
# Generate coverage report
pnpm test:cov

# View coverage report
open coverage/unit/index.html
```

**Target**: Đạt **80%+ coverage** cho business logic

---

## 7. Coding Patterns & Best Practices

### NestJS Module Structure

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Nếu cần dùng ở module khác
})
export class UsersModule {}
```

### Controller Patterns

#### Microservice Controller (NATS)

```typescript
// apps/user-app/src/users/users.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EVENTS } from '@shared/events';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(EVENTS.USER.FIND_ONE)
  async findOne(@Payload() payload: { userId: string }) {
    return this.usersService.findOne(payload.userId);
  }

  @MessagePattern(EVENTS.USER.UPDATE)
  async update(@Payload() payload: { userId: string; data: UpdateUserDto }) {
    return this.usersService.update(payload.userId, payload.data);
  }
}
```

#### Gateway Controller (REST)

```typescript
// apps/gateway/src/users/users.controller.ts
import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, retry } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { EVENTS } from '@shared/events';

@Controller('users')
export class UsersController {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Request() req) {
    return firstValueFrom(
      this.userClient.send(EVENTS.USER.FIND_ONE, { userId: req.user.userId }).pipe(
        timeout(5000),
        retry({ count: 1, delay: 1000 }),
      ),
    );
  }

  @Put('me')
  @UseGuards(AuthGuard)
  async updateCurrentUser(@Request() req, @Body() dto: UpdateUserDto) {
    return firstValueFrom(
      this.userClient
        .send(EVENTS.USER.UPDATE, { userId: req.user.userId, data: dto })
        .pipe(timeout(5000), retry({ count: 1, delay: 1000 })),
    );
  }
}
```

### Service Patterns

```typescript
// users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityNotFoundRpcException } from '@shared/exceptions';
import { UpdateUserDto } from '@shared/dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        // ❌ NEVER select passwordHash
      },
    });

    if (!user) {
      throw new EntityNotFoundRpcException('User', userId);
    }

    return user;
  }

  async update(userId: string, dto: UpdateUserDto) {
    // Validate user exists
    await this.findOne(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true,
      },
    });
  }
}
```

### DTO Patterns

```typescript
// libs/shared/dto/user/update-user.dto.ts
import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}
```

### Prisma Patterns

```typescript
// ✅ ĐÚNG: Explicit select (không leak sensitive data)
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    createdAt: true,
    // ❌ NEVER select passwordHash
  },
});

// ✅ ĐÚNG: Include relations
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    items: {
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    },
  },
});

// ✅ ĐÚNG: Transaction
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: orderData });
  await tx.cart.deleteMany({ where: { userId } });
});
```

### NATS Event Patterns

```typescript
// libs/shared/events.ts
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
  // ... more events
};
```

### Error Handling Patterns

```typescript
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
  ConflictRpcException,
  UnauthorizedRpcException,
  ForbiddenRpcException,
} from '@shared/exceptions';

// ✅ Entity not found
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}

// ✅ Validation error
if (password.length < 8) {
  throw new ValidationRpcException('Mật khẩu phải có ít nhất 8 ký tự');
}

// ✅ Conflict (duplicate)
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  throw new ConflictRpcException('Email đã được sử dụng');
}

// ✅ Unauthorized (invalid credentials)
const isValid = await bcrypt.compare(password, user.passwordHash);
if (!isValid) {
  throw new UnauthorizedRpcException('Email hoặc mật khẩu không đúng');
}

// ✅ Forbidden (no permission)
if (user.role !== 'ADMIN') {
  throw new ForbiddenRpcException('Chỉ admin mới có quyền thực hiện');
}
```

---

## 8. Database Management

### Prisma Schema Structure

```prisma
// apps/user-app/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  CUSTOMER
  ADMIN
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  firstName    String?
  lastName     String?
  avatar       String?
  role         UserRole  @default(CUSTOMER)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  addresses    Address[]

  @@map("users")
}

model Address {
  id          String   @id @default(uuid())
  userId      String
  fullName    String
  phoneNumber String
  street      String
  city        String
  state       String
  zipCode     String
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("addresses")
}
```

### Migration Workflow

```bash
# 1. Edit schema
vim apps/user-app/prisma/schema.prisma

# 2. Generate Prisma client
pnpm db:gen:all

# 3. Create migration
cd apps/user-app
npx prisma migrate dev --name add_user_avatar

# 4. Migration file will be created in:
# apps/user-app/prisma/migrations/20250101120000_add_user_avatar/migration.sql
```

### Common Prisma Commands

```bash
# Generate client (sau khi sửa schema)
npx prisma generate --schema=apps/user-app/prisma/schema.prisma

# Push schema to DB (dev only, no migration history)
npx prisma db push --schema=apps/user-app/prisma/schema.prisma

# Create migration
npx prisma migrate dev --schema=apps/user-app/prisma/schema.prisma

# Apply migrations (production)
npx prisma migrate deploy --schema=apps/user-app/prisma/schema.prisma

# Reset database (delete all data + re-run migrations)
npx prisma migrate reset --schema=apps/user-app/prisma/schema.prisma

# Open Prisma Studio
npx prisma studio --schema=apps/user-app/prisma/schema.prisma
```

### Database Seeding

```typescript
// apps/user-app/prisma/seed.ts
import { PrismaClient } from './generated/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  console.log('Created admin:', admin);

  // Create test user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      passwordHash: userPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'CUSTOMER',
    },
  });

  console.log('Created user:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```bash
# Run seed
cd apps/user-app
npx prisma db seed
```

---

## 9. Security Model

### Perimeter Security Architecture

**Mô hình:** Gateway authentication + Trusted internal network

```
┌─────────────────────────────────────────┐
│             Client                      │
└─────────────┬───────────────────────────┘
              │ HTTP + JWT
              ▼
┌─────────────────────────────────────────┐
│          Gateway                        │
│  ┌─────────────────────────────────┐   │
│  │   🛡️ AuthGuard                  │   │
│  │   - Verify JWT với RSA Public Key │   │
│  │   - Extract userId từ token      │   │
│  │   - Attach userId vào message    │   │
│  └─────────────────────────────────┘   │
│  ✅ AUTHENTICATION LAYER                │
└─────────────┬───────────────────────────┘
              │ NATS + userId in payload
              │ (Trusted Network)
              ▼
┌─────────────────────────────────────────┐
│       Microservices                     │
│       ⚙️ No Guards                      │
│       Tin tưởng Gateway                 │
└─────────────────────────────────────────┘
```

### JWT Authentication Flow

```typescript
// 1. User login → user-app generates JWT
const privateKey = await jose.importPKCS8(process.env.JWT_PRIVATE_KEY, 'RS256');
const token = await new jose.SignJWT({ sub: user.id, email: user.email, role: user.role })
  .setProtectedHeader({ alg: 'RS256' })
  .setExpirationTime('15m')
  .sign(privateKey);

// 2. Client gửi request với JWT
GET /users/me
Authorization: Bearer eyJhbGc...

// 3. Gateway verify JWT với Public Key
const publicKey = await jose.importSPKI(process.env.JWT_PUBLIC_KEY, 'RS256');
const { payload } = await jose.jwtVerify(token, publicKey);
// payload = { sub: 'user-id', email: 'user@example.com', role: 'CUSTOMER' }

// 4. Gateway attach userId vào NATS message
this.userClient.send(EVENTS.USER.FIND_ONE, { userId: payload.sub });

// 5. Microservice xử lý (không cần verify lại)
async findOne(@Payload() payload: { userId: string }) {
  return this.usersService.findOne(payload.userId);
}
```

### Security Best Practices

#### 1. RSA-based JWT (Asymmetric Encryption)

```bash
# Generate keys
pnpm generate:keys

# Keys lưu trong keys/
keys/
├── private.pem   # Sign JWT (user-app)
└── public.pem    # Verify JWT (gateway)
```

**Lợi ích:**
- Sign (private key) và verify (public key) độc lập
- Public key leak không ảnh hưởng khả năng tạo token mới
- Best practice cho distributed systems

#### 2. Short-lived Tokens

```typescript
// Token expiry: 15 phút
.setExpirationTime('15m')

// Refresh token: 7 ngày
.setExpirationTime('7d')
```

#### 3. Explicit Prisma Select

```typescript
// ✅ ĐÚNG
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    // ❌ NEVER select passwordHash
  },
});

// ❌ SAI (leak passwordHash)
const user = await prisma.user.findUnique({ where: { id } });
```

#### 4. Password Hashing

```typescript
import * as bcrypt from 'bcryptjs';

// Hash password before save
const passwordHash = await bcrypt.hash(password, 10);

// Verify password
const isValid = await bcrypt.compare(password, user.passwordHash);
```

#### 5. Input Validation

```typescript
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
```

### Guards & Authorization

#### Gateway AuthGuard

```typescript
// apps/gateway/src/auth/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@shared/jwt/jwt.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token không tồn tại');
    }

    try {
      const payload = await this.jwtService.verifyToken(token);
      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
```

#### Role-based Authorization

```typescript
// apps/gateway/src/auth/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user.role);
  }
}

// Usage
@Get('admin/users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async getAllUsers() {
  // Only admin can access
}
```

---

## 10. Error Handling

### RPC Exceptions

Sử dụng custom RPC exceptions từ `@shared/exceptions`:

```typescript
import {
  EntityNotFoundRpcException,      // 404
  ValidationRpcException,           // 400
  ConflictRpcException,             // 409
  UnauthorizedRpcException,         // 401
  ForbiddenRpcException,            // 403
  ServiceUnavailableRpcException,   // 503
  InternalServerRpcException,       // 500
} from '@shared/exceptions';
```

### When to Use Each Exception

| Exception | HTTP Code | Khi Nào Dùng | Ví Dụ |
|-----------|-----------|--------------|-------|
| `EntityNotFoundRpcException` | 404 | Resource không tồn tại | User not found, Product not found |
| `ValidationRpcException` | 400 | Input validation fail | Invalid email, password too short |
| `ConflictRpcException` | 409 | Resource conflict | Email already exists, SKU duplicate |
| `UnauthorizedRpcException` | 401 | Authentication fail | Invalid credentials, token expired |
| `ForbiddenRpcException` | 403 | Authorization fail | User không có quyền |
| `ServiceUnavailableRpcException` | 503 | External service down | Database offline, payment gateway timeout |
| `InternalServerRpcException` | 500 | Unexpected error | Unknown errors |

### Examples

```typescript
// 404 - Entity not found
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new EntityNotFoundRpcException('User', id);
}

// 400 - Validation error
if (password.length < 8) {
  throw new ValidationRpcException('Mật khẩu phải có ít nhất 8 ký tự');
}

// 409 - Conflict
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  throw new ConflictRpcException('Email đã được sử dụng');
}

// 401 - Unauthorized
const isValid = await bcrypt.compare(password, user.passwordHash);
if (!isValid) {
  throw new UnauthorizedRpcException('Email hoặc mật khẩu không đúng');
}

// 403 - Forbidden
if (user.role !== 'ADMIN') {
  throw new ForbiddenRpcException('Chỉ admin mới có quyền thực hiện');
}

// 503 - Service unavailable
try {
  await this.paymentGateway.process(payment);
} catch (error) {
  throw new ServiceUnavailableRpcException('Cổng thanh toán tạm thời không khả dụng');
}

// 500 - Internal server error
try {
  await this.processOrder(order);
} catch (error) {
  console.error('[OrderService] Unexpected error:', error);
  throw new InternalServerRpcException('Lỗi xử lý đơn hàng', {
    orderId: order.id,
    error: error.message,
  });
}
```

### Error Filter

```typescript
// libs/shared/filters/rpc-exception.filter.ts
import { Catch, RpcExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class AllRpcExceptionsFilter implements RpcExceptionFilter<RpcException> {
  catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
    const error = exception.getError();
    console.error('[RPC Exception]', error);
    return throwError(() => exception);
  }
}

// Apply in microservice
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.NATS,
    options: { servers: [process.env.NATS_URL] },
  });

  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
}
```

---

## 11. NATS Communication

### NATS Setup

```typescript
// apps/user-app/src/main.ts (Microservice)
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { UserAppModule } from './user-app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UserAppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'user-app', // Queue group for load balancing
      },
    },
  );

  await app.listen();
  console.log('🚀 User microservice is listening on NATS');
}
bootstrap();
```

```typescript
// apps/gateway/src/app.module.ts (Gateway)
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
      {
        name: 'PRODUCT_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        },
      },
    ]),
  ],
})
export class AppModule {}
```

### Message Patterns

```typescript
// Microservice: Listen to pattern
@Controller()
export class UsersController {
  @MessagePattern('user.findOne')
  async findOne(@Payload() payload: { userId: string }) {
    return this.usersService.findOne(payload.userId);
  }
}

// Gateway: Send message
@Injectable()
export class UsersGatewayService {
  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  async findOne(userId: string) {
    return firstValueFrom(
      this.userClient.send('user.findOne', { userId }).pipe(
        timeout(5000),
        retry({ count: 1, delay: 1000 }),
      ),
    );
  }
}
```

### Request-Response Pattern

```typescript
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

async findUser(userId: string) {
  return firstValueFrom(
    this.userClient.send('user.findOne', { userId }).pipe(
      timeout(5000),      // Timeout sau 5 giây
      retry({             // Retry 1 lần nếu fail
        count: 1,
        delay: 1000,      // Đợi 1 giây trước khi retry
      }),
      catchError((error) => {
        console.error('[Gateway] Find user failed:', error);
        throw new HttpException(
          error.message || 'Service communication failed',
          error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }),
    ),
  );
}
```

### Event Pattern (Fire & Forget)

```typescript
// Microservice: Listen to event
@Controller()
export class NotificationController {
  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any) {
    // Send email notification
    await this.emailService.sendOrderConfirmation(data);
  }
}

// Gateway: Emit event
this.orderClient.emit('order.created', {
  orderId: order.id,
  userId: order.userId,
  total: order.total,
});
```

### NATS Monitoring

```bash
# NATS monitoring endpoint
curl http://localhost:8222/varz

# Check connections
curl http://localhost:8222/connz

# Check subscriptions
curl http://localhost:8222/subsz
```

---

## 12. Troubleshooting

### Common Issues

#### 1. Port Conflicts

**Triệu chứng:** `Error: listen EADDRINUSE: address already in use :::3000`

**Giải pháp:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or stop Docker containers
docker compose down
```

#### 2. Database Connection Issues

**Triệu chứng:** `Error: Can't reach database server`

**Giải pháp:**
```bash
# Check database is running
docker compose ps

# Check database logs
docker compose logs user_db

# Restart database
docker compose restart user_db

# Verify connection
psql -h localhost -p 5433 -U user -d user_db
```

#### 3. Prisma Client Errors

**Triệu chứng:** `PrismaClient is unable to run in this browser environment`

**Giải pháp:**
```bash
# Regenerate Prisma client
pnpm db:gen:all

# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

#### 4. NATS Connection Issues

**Triệu chứng:** `Error: Could not connect to NATS`

**Giải pháp:**
```bash
# Check NATS is running
docker compose ps nats

# Check NATS logs
docker compose logs nats

# Restart NATS
docker compose restart nats

# Verify NATS is accessible
curl http://localhost:8222/varz
```

#### 5. Service Timeout

**Triệu chứng:** `TimeoutError: Timeout has occurred`

**Giải pháp:**
```typescript
// Increase timeout
this.userClient.send('user.findOne', { userId }).pipe(
  timeout(10000), // Increase to 10 seconds
)

// Check microservice logs
docker compose logs user-app

// Verify microservice is running
docker compose ps
```

#### 6. JWT Verification Failed

**Triệu chứng:** `Error: JWS signature verification failed`

**Giải pháp:**
```bash
# Regenerate RSA keys
pnpm generate:keys

# Verify keys exist
ls -la keys/

# Restart services
pnpm dev:all
```

#### 7. Migration Errors

**Triệu chứng:** `Migration failed to apply`

**Giải pháp:**
```bash
# Check migration status
cd apps/user-app
npx prisma migrate status

# Reset and re-run migrations (dev only!)
npx prisma migrate reset

# Or manually fix database
psql -h localhost -p 5433 -U user -d user_db
```

#### 8. Test Failures

**Triệu chứng:** Tests failing inconsistently

**Giải pháp:**
```bash
# Clear jest cache
pnpm test --clearCache

# Run tests in band (no parallel)
pnpm test --runInBand

# Check test database
docker compose -f docker-compose.test.yml ps
```

### Debug Tips

#### Enable Debug Logging

```typescript
// In main.ts
const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn', 'log', 'debug', 'verbose'],
});
```

#### NATS Debug

```bash
# Monitor NATS messages (install nats-cli)
nats sub ">"

# Subscribe to specific pattern
nats sub "user.*"
```

#### Database Debug

```bash
# Enable Prisma query logging
# In prisma.service.ts
this.prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

---

## 📚 Additional Resources

### Documentation Files

- `README.md` - Project overview
- `SETUP.md` - Setup guide
- `docs/architecture/SECURITY-ARCHITECTURE.md` - Security model chi tiết
- `docs/architecture/SECURITY-QUICK-REFERENCE.md` - Security quick reference
- `docs/knowledge/RPC-EXCEPTIONS-GUIDE.md` - RPC exceptions guide
- `docs/knowledge/TESTING.md` - Testing guide
- `apps/gateway/README.md` - Gateway documentation

### Key Directories

- `docs/ai/requirements/` - Feature requirements
- `docs/ai/planning/` - Feature planning
- `docs/ai/design/` - System design
- `docs/ai/implementation/` - Implementation guides
- `docs/ai/testing/` - Testing guides
- `http/` - HTTP test files

### Monitoring & Health Checks

```bash
# Gateway health
curl http://localhost:3000/health

# NATS monitoring
curl http://localhost:8222/varz
curl http://localhost:8222/connz
curl http://localhost:8222/subsz
```

---

## 🎯 Quick Reference

### Most Used Commands

```bash
# Development
pnpm dev:all                 # Start all services
pnpm nest start --watch gateway  # Start gateway only

# Database
pnpm db:gen:all              # Generate Prisma clients
pnpm db:migrate:all          # Run migrations
pnpm db:reset:all            # Reset all databases

# Testing
pnpm test                    # Unit tests
pnpm test:e2e                # E2E tests
pnpm test:full               # Full test suite with Docker

# Build
pnpm build:all               # Build all services
pnpm start:prod:all          # Run production build

# Docker
docker compose up -d         # Start infrastructure
docker compose down          # Stop infrastructure
docker compose logs -f       # View logs
```

### File Paths

```
Gateway: apps/gateway/src/
User Service: apps/user-app/src/
Shared Library: libs/shared/
Documentation: docs/
HTTP Tests: http/
Scripts: scripts/
```

### Environment Variables

```env
# Gateway
PORT=3000
CORS_ORIGIN=http://localhost:3001

# NATS
NATS_URL=nats://localhost:4222

# Databases
USER_DATABASE_URL=postgresql://user:user_password@localhost:5433/user_db
PRODUCT_DATABASE_URL=postgresql://product:product_password@localhost:5434/product_db
# ... more databases

# JWT
JWT_PRIVATE_KEY=<from keys/private.pem>
JWT_PUBLIC_KEY=<from keys/public.pem>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## ⚡ AI Assistant Tips

### Khi Thêm Feature Mới

1. ✅ Đọc `docs/ai/requirements/` để hiểu requirements
2. ✅ Xem `docs/ai/design/` để hiểu thiết kế
3. ✅ Follow coding patterns trong guide này
4. ✅ Viết tests (unit + E2E)
5. ✅ Update documentation
6. ✅ Tạo HTTP test file trong `http/`

### Khi Debug Issues

1. ✅ Check logs: `docker compose logs -f`
2. ✅ Verify services running: `docker compose ps`
3. ✅ Check NATS: `curl http://localhost:8222/varz`
4. ✅ Test endpoints: Use files trong `http/`
5. ✅ Check database: `psql` hoặc Prisma Studio

### Khi Review Code

1. ✅ DTOs có validation đầy đủ?
2. ✅ Prisma select explicit (không leak sensitive data)?
3. ✅ Error handling đúng (RPC exceptions)?
4. ✅ NATS communication có timeout & retry?
5. ✅ Tests coverage đủ (80%+)?
6. ✅ Security best practices được áp dụng?

---

**Version:** 1.0.0  
**Last Updated:** October 26, 2025  
**Maintainer:** Backend Team

