# Tài Liệu Kỹ Thuật: User Microservice

> **Tài liệu luận văn tốt nghiệp** - Hệ thống E-commerce Microservices  
> **Service**: User App (`apps/user-app`)  
> **Ngày phân tích**: 31/10/2025  
> **Phạm vi**: Microservice quản lý người dùng, xác thực và địa chỉ giao hàng

---

## 📋 Mục Lục

1. [Tổng Quan Microservice](#1-tổng-quan-microservice)
2. [Kiến Trúc và Thiết Kế](#2-kiến-trúc-và-thiết-kế)
3. [Cơ Sở Dữ Liệu](#3-cơ-sở-dữ-liệu)
4. [Các Module Chính](#4-các-module-chính)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [NATS Communication Patterns](#6-nats-communication-patterns)
7. [Security Implementation](#7-security-implementation)
8. [Error Handling](#8-error-handling)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Configuration](#10-deployment--configuration)
11. [Kết Luận và Đánh Giá](#11-kết-luận-và-đánh-giá)

---

## 1. Tổng Quan Microservice

### 1.1. Mục Đích và Vai Trò

**User Microservice** là một trong 7 microservices cốt lõi trong hệ thống e-commerce, chịu trách nhiệm quản lý:

- **User Management**: Quản lý thông tin người dùng (CRUD operations)
- **Authentication**: Xác thực người dùng qua email/password và JWT tokens
- **Address Management**: Quản lý địa chỉ giao hàng của người dùng

### 1.2. Vị Trí Trong Kiến Trúc Microservices

```
┌─────────────┐
│   Gateway   │ ◄─── HTTP/REST requests từ clients
└──────┬──────┘
       │ NATS messages
       ▼
┌─────────────────┐
│   NATS Broker   │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬─────────────┬─────────────┐
    ▼         ▼            ▼             ▼             ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│ USER   │ │PRODUCT │ │ CART   │ │  ORDER   │ │ PAYMENT  │
│ App    │ │  App   │ │  App   │ │   App    │ │   App    │
└───┬────┘ └────────┘ └────────┘ └──────────┘ └──────────┘
    │
    ▼
┌─────────────┐
│ PostgreSQL  │
│  user_db    │
└─────────────┘
```

### 1.3. Tech Stack

| Component            | Technology         | Version         |
| -------------------- | ------------------ | --------------- |
| **Framework**        | NestJS             | v11.x           |
| **Runtime**          | Node.js            | v20+            |
| **Language**         | TypeScript         | v5.x            |
| **Message Broker**   | NATS               | v2.29           |
| **Database**         | PostgreSQL         | v16             |
| **ORM**              | Prisma             | v6.x            |
| **Authentication**   | JWT (jose library) | RSA-based       |
| **Password Hashing** | bcryptjs           | Salt rounds: 10 |
| **Validation**       | class-validator    | -               |
| **Testing**          | Jest               | v30             |

### 1.4. Port Configuration

```
Service Port: 3001
Database Port: 5433
NATS URL: nats://localhost:4222
Queue Group: user-app
```

---

## 2. Kiến Trúc và Thiết Kế

### 2.1. Layered Architecture Pattern

User Microservice áp dụng kiến trúc phân lớp (Layered Architecture):

```
┌─────────────────────────────────────────────────────────┐
│                   NATS Transport Layer                   │
│              (Message Pattern Handlers)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Controller Layer                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   Users      │ │     Auth     │ │   Address    │   │
│  │ Controller   │ │  Controller  │ │  Controller  │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ Delegates business logic
┌────────────────────▼────────────────────────────────────┐
│                  Service Layer                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   Users      │ │     Auth     │ │   Address    │   │
│  │   Service    │ │   Service    │ │   Service    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ Database operations
┌────────────────────▼────────────────────────────────────┐
│               Data Access Layer                          │
│              (Prisma ORM Client)                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                PostgreSQL Database                       │
│                   (user_db)                              │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Module Structure

```typescript
// apps/user-app/src/user-app.module.ts
@Module({
  imports: [
    JwtModule, // Shared JWT utilities
    TerminusModule, // Health checks
    UsersModule, // User management
    AuthModule, // Authentication
    AddressModule, // Address management
  ],
  providers: [PrismaService],
})
export class UserAppModule {}
```

**Thiết kế Module:**

- **Separation of Concerns**: Mỗi domain (users, auth, address) có module riêng
- **Dependency Injection**: NestJS IoC container quản lý dependencies
- **Shared Services**: PrismaService được chia sẻ giữa các modules

### 2.3. Bootstrap Configuration

```typescript
// apps/user-app/src/main.ts
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(UserAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'user-app', // Load balancing queue group
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global RPC exception filter
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
}
```

**Key Design Decisions:**

1. **Queue-based Load Balancing**: `queue: 'user-app'` cho phép horizontal scaling
2. **Global Validation**: Đảm bảo mọi incoming message đều được validate
3. **Centralized Error Handling**: Global exception filter xử lý tất cả RPC errors

---

## 3. Cơ Sở Dữ Liệu

### 3.1. Database Schema Design

```prisma
// apps/user-app/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_USER")
}

generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

// Enum cho User roles
enum UserRole {
  ADMIN
  CUSTOMER
}

// User Entity
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String    // NEVER exposed in responses
  fullName     String
  phone        String?
  role         UserRole  @default(CUSTOMER)
  isActive     Boolean   @default(true)
  addresses    Address[] // One-to-many relationship
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

// Address Entity
model Address {
  id        String   @id @default(cuid())
  userId    String
  fullName  String   // Recipient name
  phone     String   // Recipient phone
  street    String
  ward      String   // Phường/Xã
  district  String   // Quận/Huyện
  city      String   // Tỉnh/Thành phố
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

### 3.2. Database Design Principles

#### 3.2.1. Database Per Service Pattern

**Critical Principle**: Mỗi microservice có database HOÀN TOÀN RIÊNG BIỆT.

```
user-app    → user_db (port 5433)
product-app → product_db (port 5434)
cart-app    → cart_db (port 5435)
...
```

**Lý do:**

- ✅ **Loose Coupling**: Services không phụ thuộc vào database của nhau
- ✅ **Independent Scaling**: Có thể scale database theo nhu cầu của từng service
- ✅ **Technology Freedom**: Có thể chọn database khác nhau cho mỗi service
- ✅ **Failure Isolation**: Lỗi database không lan truyền sang services khác

**Trade-offs:**

- ❌ **Data Duplication**: Một số data phải được duplicate (eventual consistency)
- ❌ **Complex Queries**: Không thể JOIN trực tiếp giữa các services
- ❌ **Distributed Transactions**: Phải implement saga pattern hoặc 2PC

### 3.3. Entity Relationships

```mermaid
erDiagram
    User ||--o{ Address : has

    User {
        string id PK
        string email UK
        string passwordHash
        string fullName
        string phone
        UserRole role
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Address {
        string id PK
        string userId FK
        string fullName
        string phone
        string street
        string ward
        string district
        string city
        boolean isDefault
        datetime createdAt
    }
```

### 3.4. Database Query Patterns

#### 3.4.1. Explicit Select Pattern

**CRITICAL SECURITY RULE**: LUÔN dùng explicit select để tránh leak sensitive data.

```typescript
// ✅ CORRECT - Explicit select (không expose passwordHash)
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    fullName: true,
    phone: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    // NEVER select passwordHash
  },
});

// ❌ WRONG - Exposes ALL fields including passwordHash
const user = await prisma.user.findUnique({ where: { id } });
```

### 3.5. Database Migration Strategy

```bash
# 1. Create migration
cd apps/user-app
npx prisma migrate dev --name add_user_avatar_field

# 2. Generate Prisma client
pnpm db:gen:all

# 3. Apply to production
npx prisma migrate deploy
```

**Migration Best Practices:**

- ✅ Descriptive migration names
- ✅ Test migrations trên staging environment
- ✅ Backup database trước khi migrate
- ✅ Có rollback plan

---

## 4. Các Module Chính

### 4.1. Users Module

#### 4.1.1. Chức Năng

```typescript
// Interface định nghĩa contract
export interface IUserService {
  create(dto: CreateUserDto): Promise<UserResponse>;
  findById(id: string): Promise<UserResponse>;
  findByEmail(email: string): Promise<UserResponse>;
  update(id: string, dto: UpdateUserDto): Promise<UserResponse>;
  deactivate(id: string): Promise<{ message: string }>;
  list(query: ListUsersDto): Promise<ListUsersResponse>;
}
```

#### 4.1.2. NATS Event Handlers

| Event Pattern      | Payload           | Response            | Description                  |
| ------------------ | ----------------- | ------------------- | ---------------------------- |
| `user.create`      | `CreateUserDto`   | `UserResponse`      | Tạo user mới (admin only)    |
| `user.findById`    | `string` (userId) | `UserResponse`      | Tìm user theo ID             |
| `user.findByEmail` | `string` (email)  | `UserResponse`      | Tìm user theo email          |
| `user.update`      | `{id, dto}`       | `UserResponse`      | Cập nhật user info           |
| `user.deactivate`  | `string` (userId) | `{message}`         | Vô hiệu hóa account          |
| `user.list`        | `ListUsersDto`    | `ListUsersResponse` | Danh sách users (pagination) |

#### 4.1.3. Business Logic Highlights

**Create User:**

```typescript
async create(dto: CreateUserDto): Promise<UserResponse> {
  // 1. Validate email uniqueness
  const existingUser = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });
  if (existingUser) {
    throw new RpcException({ statusCode: 400, message: 'Email already exists' });
  }

  // 2. Hash password (bcrypt, salt rounds = 10)
  const passwordHash = await bcrypt.hash(dto.password, 10);

  // 3. Create user with explicit select
  const user = await this.prisma.user.create({
    data: { email: dto.email, passwordHash, fullName: dto.fullName, ... },
    select: { id: true, email: true, fullName: true, ... }, // NO passwordHash
  });

  return user as UserResponse;
}
```

**List Users (Pagination + Search):**

```typescript
async list(query: ListUsersDto): Promise<ListUsersResponse> {
  const { page = 1, limit = 10, search } = query;
  const skip = (page - 1) * limit;

  // Build WHERE clause for search
  const where = search ? {
    OR: [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ],
  } : {};

  // Execute queries in parallel
  const [users, total] = await Promise.all([
    this.prisma.user.findMany({ where, skip, take: limit, ... }),
    this.prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
```

---

### 4.2. Auth Module

#### 4.2.1. Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant NATS
    participant UserApp
    participant DB
    participant JWT

    %% Login Flow
    Client->>Gateway: POST /auth/login {email, password}
    Gateway->>NATS: auth.login
    NATS->>UserApp: auth.login
    UserApp->>DB: findUnique({ email })
    DB-->>UserApp: User (with passwordHash)
    UserApp->>UserApp: bcrypt.compare(password, hash)
    alt Password valid
        UserApp->>JWT: sign({ sub: userId, email, role })
        JWT-->>UserApp: { accessToken, refreshToken }
        UserApp-->>NATS: { accessToken, refreshToken }
        NATS-->>Gateway: { accessToken, refreshToken }
        Gateway-->>Client: 200 OK + tokens
    else Password invalid
        UserApp-->>NATS: RpcException (401)
        NATS-->>Gateway: RpcException
        Gateway-->>Client: 401 Unauthorized
    end
```

#### 4.2.2. JWT Token Structure

**Access Token Payload:**

```typescript
{
  sub: "clxyz123...",        // User ID (JOSE standard claim)
  email: "user@example.com",
  role: "CUSTOMER",          // or "ADMIN"
  iat: 1730361600,           // Issued at
  exp: 1730362500            // Expires in 15 minutes
}
```

**Refresh Token Payload:**

```typescript
{
  sub: "clxyz123...",
  email: "user@example.com",
  role: "CUSTOMER",
  iat: 1730361600,
  exp: 1730966400            // Expires in 7 days
}
```

#### 4.2.3. JWT Implementation Details

**Signing (RSA Private Key):**

```typescript
const privateKey = await importPKCS8(process.env.JWT_PRIVATE_KEY, 'RS256');

const token = await new SignJWT(payload)
  .setProtectedHeader({ alg: 'RS256' })
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(privateKey);
```

**Verification (RSA Public Key):**

```typescript
const publicKey = await importSPKI(process.env.JWT_PUBLIC_KEY, 'RS256');

const { payload } = await jwtVerify(token, publicKey, {
  algorithms: ['RS256'],
});

return payload; // { sub, email, role, iat, exp }
```

**Tại sao dùng RSA (Asymmetric) thay vì HMAC (Symmetric)?**

| Aspect               | HMAC (HS256)                                  | RSA (RS256)                                           |
| -------------------- | --------------------------------------------- | ----------------------------------------------------- |
| **Key Type**         | Symmetric (1 secret key)                      | Asymmetric (public + private)                         |
| **Signing**          | Gateway + All services cần secret             | Chỉ Auth Service có private key                       |
| **Verification**     | Gateway + All services cần secret             | Gateway + All services có public key                  |
| **Security**         | Secret key leak = toàn bộ hệ thống compromise | Private key leak = chỉ Auth Service compromise        |
| **Key Distribution** | Phải bảo mật secret key cho mọi service       | Public key có thể public, chỉ private key cần bảo mật |

**Lý do chọn RSA:**

- ✅ **Better Security**: Chỉ Auth Service có private key để sign tokens
- ✅ **Easy Key Distribution**: Public key có thể share công khai
- ✅ **Service Isolation**: Các services khác chỉ verify, không sign được token

#### 4.2.4. Register Flow

```typescript
async register(dto: RegisterDto): Promise<AuthResponse> {
  // 1. Validate email uniqueness
  const existingEmail = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });
  if (existingEmail) {
    throw new RpcException({ statusCode: 400, message: 'Email already exists' });
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(dto.password, 10);

  // 3. Create user (ALWAYS CUSTOMER, never allow self-register as ADMIN)
  const newUser = await this.prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: 'CUSTOMER',  // Hardcoded
    },
    select: { id: true, email: true, role: true },
  });

  // 4. Auto-login: Generate tokens
  return this.generateTokens({
    sub: newUser.id,
    email: newUser.email,
    role: newUser.role,
  });
}
```

**Security Note:** Register endpoint chỉ tạo `CUSTOMER`. Admin accounts phải tạo qua admin panel hoặc seed script.

#### 4.2.5. Refresh Token Flow

```typescript
async refresh(dto: RefreshDto): Promise<AuthResponse> {
  // 1. Verify refresh token
  const payload = await this.jwtService.verify(dto.refreshToken);

  // 2. Check user still exists and active
  const user = await this.prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new RpcException({ statusCode: 401, message: 'Invalid refresh token' });
  }

  // 3. Generate new tokens
  return this.generateTokens({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
}
```

---

### 4.3. Address Module

#### 4.3.1. Chức Năng

- **CRUD Operations**: Create, Read, Update, Delete shipping addresses
- **Default Address Logic**: Tự động set/unset default address
- **User Isolation**: Mỗi user chỉ thấy addresses của mình

#### 4.3.2. Default Address Logic

**Create First Address:**

```typescript
async create(userId: string, dto: AddressCreateDto): Promise<AddressResponse> {
  // Check if user has any addresses
  const existingAddresses = await this.prisma.address.count({
    where: { userId },
  });

  // First address is automatically default
  const isDefault = existingAddresses === 0;

  const address = await this.prisma.address.create({
    data: { ...dto, userId, isDefault },
  });

  return address;
}
```

**Set Default Address:**

```typescript
async setDefault(dto: AddressSetDefaultDto): Promise<AddressResponse> {
  const { id, userId } = dto;

  // Verify ownership
  const address = await this.prisma.address.findUnique({
    where: { id },
  });
  if (!address || address.userId !== userId) {
    throw new EntityNotFoundRpcException('Address', id);
  }

  // Atomic transaction: unset old default + set new default
  await this.prisma.$transaction(async (prisma) => {
    // Unset all defaults for this user
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.address.update({
      where: { id },
      data: { isDefault: true },
    });
  });

  // Return updated address
  return this.prisma.address.findUnique({ where: { id } });
}
```

**Delete Default Address:**

```typescript
async delete(id: string): Promise<{ success: boolean; message: string }> {
  const address = await this.prisma.address.findUnique({ where: { id } });
  if (!address) {
    throw new EntityNotFoundRpcException('Address', id);
  }

  const wasDefault = address.isDefault;
  const userId = address.userId;

  // Delete address
  await this.prisma.address.delete({ where: { id } });

  // If deleted address was default, auto-assign new default
  if (wasDefault) {
    const remainingAddresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });

    if (remainingAddresses.length > 0) {
      await this.prisma.address.update({
        where: { id: remainingAddresses[0].id },
        data: { isDefault: true },
      });
    }
  }

  return { success: true, message: 'Xóa địa chỉ thành công' };
}
```

---

## 5. Authentication & Authorization

### 5.1. Perimeter Security Model

Hệ thống áp dụng **Perimeter Security Pattern**:

```
┌─────────────────────────────────────────────────────────┐
│                      GATEWAY                             │
│                  (Security Perimeter)                    │
│                                                          │
│  ┌────────────┐     ┌─────────────┐                    │
│  │ AuthGuard  │────▶│ JWT Verify  │                    │
│  └────────────┘     └─────────────┘                    │
│         │                  │                             │
│         ▼                  ▼                             │
│  Attach userId      Extract role                        │
│  to payload        to payload                           │
└───────────────────────┬─────────────────────────────────┘
                        │ NATS: { userId, ...payload }
                        ▼
┌─────────────────────────────────────────────────────────┐
│                   MICROSERVICES                          │
│               (No Guards, Trust Gateway)                 │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │  Users   │  │  Products│  │   Cart   │             │
│  │  Service │  │  Service │  │  Service │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

**Nguyên tắc:**

1. **Gateway**: Verify JWT và attach `userId` vào NATS message
2. **Microservices**: Trust messages từ Gateway, KHÔNG có guards

**Code Implementation:**

```typescript
// ✅ Gateway Controller (có AuthGuard)
@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(AuthGuard) // Verify JWT
  async getProfile(@Request() req) {
    return firstValueFrom(
      this.userClient.send(EVENTS.USER.FIND_BY_ID, {
        userId: req.user.userId, // Attach userId
      }),
    );
  }
}

// ✅ Microservice Controller (không có guards)
@Controller()
export class UsersController {
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  async findById(@Payload() payload: { userId: string }) {
    // Trust Gateway - không cần verify lại
    return this.usersService.findById(payload.userId);
  }
}
```

### 5.2. Role-Based Access Control (RBAC)

**User Roles:**

```typescript
enum UserRole {
  ADMIN, // Full access
  CUSTOMER, // Limited access
}
```

**Role Check (Gateway Level):**

```typescript
@Controller('users')
export class UsersController {
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN) // Only admins
  async listUsers(@Query() query: ListUsersDto) {
    return firstValueFrom(this.userClient.send(EVENTS.USER.LIST, query));
  }
}
```

### 5.3. Password Security

**Hashing Algorithm:**

- **Library**: `bcryptjs`
- **Algorithm**: bcrypt (based on Blowfish cipher)
- **Salt Rounds**: 10
- **Hash Length**: 60 characters

**Implementation:**

```typescript
// Hash password
const passwordHash = await bcrypt.hash(plainPassword, 10);

// Verify password
const isValid = await bcrypt.compare(plainPassword, storedHash);
```

**Tại sao bcrypt?**

- ✅ **Slow by Design**: Chống brute-force attacks
- ✅ **Adaptive**: Có thể tăng cost factor theo thời gian
- ✅ **Salt Included**: Chống rainbow table attacks
- ✅ **Battle-tested**: Standard trong industry

---

## 6. NATS Communication Patterns

### 6.1. Request-Response Pattern

**Định nghĩa Event:**

```typescript
// libs/shared/events.ts
export const EVENTS = {
  USER: {
    FIND_BY_ID: 'user.findById',
    FIND_BY_EMAIL: 'user.findByEmail',
    CREATE: 'user.create',
    UPDATE: 'user.update',
    DEACTIVATE: 'user.deactivate',
    LIST: 'user.list',
  },
  AUTH: {
    REGISTER: 'auth.register',
    LOGIN: 'auth.login',
    VERIFY: 'auth.verify',
    REFRESH: 'auth.refresh',
  },
  ADDRESS: {
    LIST_BY_USER: 'address.listByUser',
    CREATE: 'address.create',
    UPDATE: 'address.update',
    DELETE: 'address.delete',
    SET_DEFAULT: 'address.setDefault',
  },
};
```

### 6.2. Gateway → Microservice Communication

**Gateway Side:**

```typescript
// Gateway calls User Service
return firstValueFrom(
  this.userClient.send(EVENTS.USER.FIND_BY_ID, { userId: req.user.userId }).pipe(
    timeout(5000), // 5s timeout
    retry({
      count: 1, // Retry once
      delay: 1000, // 1s delay
    }),
  ),
);
```

**Microservice Side:**

```typescript
@Controller()
export class UsersController {
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  async findById(@Payload() payload: { userId: string }) {
    return this.usersService.findById(payload.userId);
  }
}
```

### 6.3. Error Handling in NATS

**Microservice throws RPC Exception:**

```typescript
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}
```

**Gateway receives and transforms:**

```typescript
@Catch(RpcException)
export class AllRpcExceptionsFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const error = exception.getError();
    const response = host.switchToHttp().getResponse();

    response.status(error.statusCode).json({
      statusCode: error.statusCode,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 6.4. Load Balancing với Queue Groups

```typescript
// Multiple instances subscribe to same queue
{
  transport: Transport.NATS,
  options: {
    servers: ['nats://localhost:4222'],
    queue: 'user-app',  // Queue group name
  },
}
```

**Behavior:**

- NATS distributes messages round-robin giữa các instances
- Mỗi message chỉ được 1 instance xử lý
- Automatic failover nếu 1 instance chết

---

## 7. Security Implementation

### 7.1. Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Transport Security (HTTPS/TLS)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 2: Authentication (JWT Verification)              │
│  - RSA signature verification                            │
│  - Token expiry check                                    │
│  - Blacklist check (future)                              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 3: Authorization (RBAC)                            │
│  - Role-based access control                             │
│  - Resource ownership check                              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 4: Input Validation                                │
│  - class-validator decorators                            │
│  - Whitelist unknown properties                          │
│  - Type transformation                                   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│ Layer 5: Data Access Control                             │
│  - Explicit select (no passwordHash)                     │
│  - Row-level security checks                             │
└─────────────────────────────────────────────────────────┘
```

### 7.2. Input Validation

**DTO Validation Example:**

```typescript
export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @IsNotEmpty()
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{10,11}$/)
  phone?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
```

**Validation Pipe Configuration:**

```typescript
new ValidationPipe({
  whitelist: true, // Strip properties not in DTO
  forbidNonWhitelisted: true, // Throw error on unknown properties
  transform: true, // Auto-transform to DTO class
  transformOptions: {
    enableImplicitConversion: true, // '123' → 123
  },
});
```

### 7.3. Sensitive Data Protection

**CRITICAL RULES:**

1. **NEVER expose passwordHash:**

```typescript
// ✅ CORRECT
select: {
  id: true,
  email: true,
  fullName: true,
  // passwordHash: false (implicit)
}

// ❌ WRONG
select: { ... }  // Exposes ALL fields
```

2. **NEVER log sensitive data:**

```typescript
// ✅ CORRECT
console.log('User login:', { email: dto.email });

// ❌ WRONG
console.log('User login:', dto); // Logs password
```

3. **NEVER return sensitive data in errors:**

```typescript
// ✅ CORRECT
throw new RpcException({
  statusCode: 400,
  message: 'Invalid credentials',
});

// ❌ WRONG
throw new RpcException({
  message: `Password ${dto.password} does not match`,
});
```

### 7.4. SQL Injection Prevention

Prisma ORM provides **automatic SQL injection protection**:

```typescript
// ✅ SAFE - Prisma uses parameterized queries
const user = await prisma.user.findUnique({
  where: { email: userInput }, // Automatically escaped
});

// ❌ DANGEROUS - Raw SQL (avoid if possible)
await prisma.$executeRaw`SELECT * FROM users WHERE email = ${userInput}`;
```

### 7.5. Rate Limiting (Future Enhancement)

**Recommended Strategy:**

- Implement rate limiting ở Gateway layer
- Use Redis để store rate limit counters
- Limits: 100 requests/minute per IP
- Separate limits cho login attempts (5 attempts/15 minutes)

---

## 8. Error Handling

### 8.1. RPC Exception Hierarchy

```typescript
// libs/shared/exceptions/
├── entity-not-found.rpc-exception.ts    // 404
├── validation.rpc-exception.ts          // 400
├── conflict.rpc-exception.ts            // 409
├── unauthorized.rpc-exception.ts        // 401
├── forbidden.rpc-exception.ts           // 403
├── service-unavailable.rpc-exception.ts // 503
└── internal-server.rpc-exception.ts     // 500
```

### 8.2. Exception Usage Examples

```typescript
// Entity not found
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}
// → "User với ID 'abc123' không tồn tại"

// Conflict
if (existingEmail) {
  throw new ConflictRpcException('Email đã được sử dụng');
}

// Validation
if (!isValidFormat) {
  throw new ValidationRpcException('Email không hợp lệ');
}

// Unauthorized
if (!passwordValid) {
  throw new UnauthorizedRpcException('Thông tin đăng nhập không chính xác');
}
```

### 8.3. Global Exception Filter

```typescript
@Catch(RpcException)
export class AllRpcExceptionsFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const error = exception.getError() as any;

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    });
  }
}
```

### 8.4. Error Logging Strategy

```typescript
try {
  // Business logic
} catch (error) {
  // Re-throw known errors
  if (error instanceof RpcException) {
    throw error;
  }

  // Log unexpected errors
  console.error('[UsersService] create error:', error);

  // Throw generic error
  throw new InternalServerRpcException('Lỗi khi tạo user');
}
```

---

## 9. Testing Strategy

### 9.1. Testing Pyramid

```
        ┌─────────────┐
        │   E2E Tests │  ◄── Integration with NATS + DB
        │   (10-20%)  │
        └─────────────┘
       ┌───────────────┐
       │  Unit Tests   │   ◄── Business logic + mocked dependencies
       │   (70-80%)    │
       └───────────────┘
```

### 9.2. Unit Testing

**Test File Structure:**

```
apps/user-app/src/users/
├── users.controller.ts
├── users.controller.spec.ts      ◄── Unit test
├── users.service.ts
└── users.service.spec.ts         ◄── Unit test
```

**Service Unit Test Example:**

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
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', email: 'test@example.com', ... };
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findById('1');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: expect.any(Object),
      });
    });

    it('should throw EntityNotFoundRpcException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.findById('invalid-id'))
        .rejects
        .toThrow(EntityNotFoundRpcException);
    });
  });
});
```

### 9.3. E2E Testing

**Test File Structure:**

```
apps/user-app/test/
├── users.e2e-spec.ts
├── auth.e2e-spec.ts
├── address.e2e-spec.ts
└── jest-e2e.json
```

**E2E Test Example:**

```typescript
describe('Auth E2E', () => {
  let app: INestMicroservice;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [UserAppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: { servers: ['nats://localhost:4222'] },
    });

    await app.listen();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('auth.register', () => {
    it('should register new user successfully', async () => {
      const dto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        fullName: 'New User',
      };

      const result = await firstValueFrom(app.get(ClientProxy).send(EVENTS.AUTH.REGISTER, dto));

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });

      // Verify user created in DB
      const user = await prisma.user.findUnique({
        where: { email: dto.email },
      });
      expect(user).toBeDefined();
      expect(user.role).toBe('CUSTOMER');
    });

    it('should throw error when email exists', async () => {
      // Create user first
      await prisma.user.create({
        data: {
          email: 'existing@example.com',
          passwordHash: await bcrypt.hash('password', 10),
          fullName: 'Existing User',
        },
      });

      const dto: RegisterDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        fullName: 'Another User',
      };

      await expectRpcErrorWithStatus(
        firstValueFrom(app.get(ClientProxy).send(EVENTS.AUTH.REGISTER, dto)),
        400,
        'Email already exists',
      );
    });
  });
});
```

### 9.4. Test Database Setup

**Docker Compose for Test DB:**

```yaml
# docker-compose.test.yml
services:
  user-db-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: user_db_test
    ports:
      - '5444:5432'
```

**Test Script:**

```bash
# Run E2E tests with Docker
pnpm test:e2e

# Script steps:
# 1. docker-compose -f docker-compose.test.yml up -d
# 2. npx prisma migrate deploy --schema apps/user-app/prisma/schema.prisma
# 3. jest --config jest.e2e.js
# 4. docker-compose -f docker-compose.test.yml down
```

### 9.5. Test Coverage Goals

| Coverage Type  | Target |
| -------------- | ------ |
| **Statements** | ≥ 80%  |
| **Branches**   | ≥ 75%  |
| **Functions**  | ≥ 80%  |
| **Lines**      | ≥ 80%  |

**Generate Coverage Report:**

```bash
pnpm test --coverage
# Opens coverage/lcov-report/index.html
```

---

## 10. Deployment & Configuration

### 10.1. Environment Variables

```bash
# Database
DATABASE_URL_USER=postgresql://postgres:postgres@localhost:5433/user_db

# NATS
NATS_URL=nats://localhost:4222

# JWT
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Service
NODE_ENV=production
PORT=3001
```

### 10.2. Docker Configuration

**Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY apps/user-app/prisma ./apps/user-app/prisma

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm db:gen:user

# Copy source code
COPY . .

# Build application
RUN pnpm build user-app

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built app and node_modules
COPY --from=builder /app/dist/apps/user-app ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/user-app/prisma ./prisma

# Run migrations on startup
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

**Docker Compose:**

```yaml
# docker-compose.yml
services:
  user-app:
    build:
      context: .
      dockerfile: apps/user-app/Dockerfile
    environment:
      DATABASE_URL_USER: postgresql://postgres:postgres@user-db:5432/user_db
      NATS_URL: nats://nats:4222
      JWT_PRIVATE_KEY: ${JWT_PRIVATE_KEY}
      JWT_PUBLIC_KEY: ${JWT_PUBLIC_KEY}
    depends_on:
      - user-db
      - nats
    restart: unless-stopped

  user-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: user_db
    ports:
      - '5433:5432'
    volumes:
      - user-db-data:/var/lib/postgresql/data

  nats:
    image: nats:2.10-alpine
    ports:
      - '4222:4222'
      - '8222:8222' # Monitoring

volumes:
  user-db-data:
```

### 10.3. Health Checks

**Terminus Health Check:**

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.$queryRaw`SELECT 1`, // DB health
    ]);
  }
}
```

**Docker Health Check:**

```yaml
services:
  user-app:
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3001/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 10.4. Scaling Strategy

**Horizontal Scaling:**

```yaml
services:
  user-app:
    deploy:
      replicas: 3 # Run 3 instances
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

**Load Balancing:**

- NATS queue groups handle load balancing automatically
- Mỗi instance subscribe vào `queue: 'user-app'`
- NATS distributes messages round-robin

**Database Connection Pooling:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_USER")
}

// Prisma automatically pools connections (default: 10 connections)
```

### 10.5. Monitoring & Logging

**Logging Strategy:**

```typescript
// Structured logging
console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    service: 'user-app',
    event: 'user.created',
    userId: user.id,
    email: user.email,
  }),
);
```

**Metrics to Track:**

- Request latency (p50, p95, p99)
- Error rate
- Database query time
- NATS message throughput
- Memory usage
- CPU usage

**Recommended Tools:**

- **Logging**: Winston + ELK Stack (Elasticsearch, Logstash, Kibana)
- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger or Zipkin
- **APM**: New Relic or Datadog

---

## 11. Kết Luận và Đánh Giá

### 11.1. Ưu Điểm Của Thiết Kế

✅ **Tách biệt trách nhiệm rõ ràng:**

- User Management, Authentication, Address Management là 3 modules độc lập
- Mỗi module có controller, service, DTOs riêng

✅ **Security tốt:**

- JWT với RSA (asymmetric encryption)
- Password hashing với bcrypt (salt rounds = 10)
- Explicit select để tránh leak sensitive data
- Perimeter security model (chỉ Gateway có guards)

✅ **Scalability:**

- Database per service pattern
- NATS queue groups cho horizontal scaling
- Stateless service (có thể run multiple instances)

✅ **Type Safety:**

- TypeScript với strict mode
- Interface-driven development
- DTO validation với class-validator

✅ **Testability:**

- Unit tests với mocked dependencies
- E2E tests với real NATS và test DB
- Test coverage > 80%

✅ **Documentation:**

- JSDoc comments cho public methods
- Inline comments giải thích business logic
- README và architecture docs

### 11.2. Nhược Điểm và Trade-offs

❌ **Data Duplication:**

- User data có thể cần duplicate sang các services khác (eventual consistency)
- VD: Order service cần lưu user info snapshot

❌ **Complex Queries:**

- Không thể JOIN trực tiếp với data từ services khác
- Phải gọi multiple services và merge data ở application layer

❌ **Distributed Transactions:**

- Không có ACID transactions giữa các services
- Phải implement saga pattern hoặc compensating transactions

❌ **Network Overhead:**

- Mỗi operation cần network call qua NATS
- Latency cao hơn so với monolithic

❌ **Operational Complexity:**

- Phải deploy và monitor nhiều services
- Debugging phức tạp hơn (distributed tracing required)

### 11.3. Lessons Learned

**1. Perimeter Security là phù hợp:**

- Giảm complexity ở microservices
- Centralized authentication logic ở Gateway
- Trade-off: Gateway trở thành single point of failure

**2. Explicit Select là bắt buộc:**

- Nhiều lần suýt leak passwordHash do quên select
- Best practice: Tạo reusable select objects

**3. NATS Queue Groups hoạt động tốt:**

- Load balancing tự động, không cần external load balancer
- Easy horizontal scaling

**4. Testing phải có E2E:**

- Unit tests không đủ để catch integration bugs
- E2E tests với real NATS và DB rất quan trọng

### 11.4. Khuyến Nghị Cải Tiến

**Short-term (3-6 months):**

1. **Implement Refresh Token Rotation:**
   - Current: Refresh token không rotate
   - Goal: Tăng security bằng cách rotate refresh token sau mỗi use

2. **Add Rate Limiting:**
   - Current: Không có rate limiting
   - Goal: Protect against brute-force attacks (especially login)

3. **Implement Soft Delete:**
   - Current: Hard delete users và addresses
   - Goal: Soft delete để có thể recover data

**Medium-term (6-12 months):** 4. **Add Observability:**

- Implement distributed tracing (Jaeger)
- Add structured logging (Winston + ELK)
- Setup monitoring dashboards (Prometheus + Grafana)

5. **Implement Event Sourcing cho User Changes:**
   - Track all user changes for audit log
   - Enable point-in-time recovery

6. **Add GraphQL Gateway:**
   - Current: REST API
   - Goal: Giảm over-fetching và under-fetching

**Long-term (12+ months):** 7. **Migrate to gRPC:**

- Current: NATS với JSON payload
- Goal: Better performance với Protobuf

8. **Implement CQRS:**
   - Separate read và write models
   - Optimize queries với read replicas

9. **Add Machine Learning:**
   - Fraud detection cho login attempts
   - Anomaly detection cho user behavior

### 11.5. Đóng Góp Cho Luận Văn

**Kiến thức thu được:**

- Hiểu sâu về Microservices Architecture
- Hands-on experience với NATS message broker
- JWT authentication với RSA (asymmetric crypto)
- Database per service pattern
- Testing strategies (unit + E2E)

**Skills phát triển:**

- NestJS framework (TypeScript)
- Prisma ORM
- Docker và Docker Compose
- PostgreSQL database design
- Security best practices

**Challenges đã vượt qua:**

- Thiết kế communication patterns giữa services
- Handle distributed transactions
- Implement perimeter security model
- Debug issues trong distributed system

### 11.6. Tài Liệu Tham Khảo

**Books:**

1. "Building Microservices" - Sam Newman
2. "Microservices Patterns" - Chris Richardson
3. "Designing Data-Intensive Applications" - Martin Kleppmann

**Documentation:**

- NestJS Documentation: https://docs.nestjs.com/
- NATS Documentation: https://docs.nats.io/
- Prisma Documentation: https://www.prisma.io/docs/

**Blog Posts:**

- Microservices.io Patterns: https://microservices.io/patterns/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

**GitHub Repos:**

- NestJS Sample Projects: https://github.com/nestjs/nest/tree/master/sample

---

## Phụ Lục

### A. Database Schema Diagram

```mermaid
erDiagram
    User ||--o{ Address : "has many"

    User {
        string id PK "CUID"
        string email UK "Email address"
        string passwordHash "bcrypt hash"
        string fullName "Full name"
        string phone "Phone number (optional)"
        UserRole role "ADMIN or CUSTOMER"
        boolean isActive "Account status"
        datetime createdAt "Created timestamp"
        datetime updatedAt "Updated timestamp"
    }

    Address {
        string id PK "CUID"
        string userId FK "References User.id"
        string fullName "Recipient name"
        string phone "Recipient phone"
        string street "Street address"
        string ward "Ward (Phường/Xã)"
        string district "District (Quận/Huyện)"
        string city "City (Tỉnh/TP)"
        boolean isDefault "Is default address"
        datetime createdAt "Created timestamp"
    }
```

### B. API Endpoints Overview

| Endpoint                 | Method | Auth  | Description                  |
| ------------------------ | ------ | ----- | ---------------------------- |
| `/auth/register`         | POST   | No    | Đăng ký tài khoản mới        |
| `/auth/login`            | POST   | No    | Đăng nhập                    |
| `/auth/refresh`          | POST   | No    | Refresh access token         |
| `/users/me`              | GET    | Yes   | Lấy thông tin user hiện tại  |
| `/users/:id`             | GET    | Admin | Lấy user theo ID             |
| `/users`                 | GET    | Admin | Danh sách users              |
| `/users/:id`             | PATCH  | Yes   | Cập nhật user                |
| `/users/:id/deactivate`  | POST   | Admin | Vô hiệu hóa user             |
| `/addresses`             | GET    | Yes   | Danh sách addresses của user |
| `/addresses`             | POST   | Yes   | Tạo address mới              |
| `/addresses/:id`         | PATCH  | Yes   | Cập nhật address             |
| `/addresses/:id`         | DELETE | Yes   | Xóa address                  |
| `/addresses/:id/default` | POST   | Yes   | Đặt address làm default      |

### C. Environment Setup Guide

```bash
# 1. Clone repository
git clone https://github.com/your-org/backend-luan-van.git
cd backend-luan-van

# 2. Install dependencies
pnpm install

# 3. Generate JWT keys
pnpm generate:keys

# 4. Setup environment variables
cp .env.example .env
# Edit .env with your values

# 5. Start infrastructure
docker-compose up -d nats user-db

# 6. Run database migrations
pnpm db:migrate:user

# 7. Seed database (optional)
cd apps/user-app
node scripts/seed.js

# 8. Start development server
pnpm nest start --watch user-app

# 9. Run tests
pnpm test user-app
pnpm test:e2e user-app
```

### D. Troubleshooting Common Issues

**Issue 1: Database connection error**

```
Error: P1001: Can't reach database server
```

**Solution:**

- Check Docker container is running: `docker ps`
- Check DATABASE_URL environment variable
- Check firewall not blocking port 5433

**Issue 2: NATS connection error**

```
Error: Could not connect to NATS server
```

**Solution:**

- Check NATS container: `docker logs nats`
- Check NATS_URL environment variable
- Try restart NATS: `docker-compose restart nats`

**Issue 3: JWT verification failed**

```
Error: Invalid JWT signature
```

**Solution:**

- Check JWT_PUBLIC_KEY and JWT_PRIVATE_KEY match
- Regenerate keys: `pnpm generate:keys`
- Check keys format (must include `\n` for newlines)

**Issue 4: Prisma client not found**

```
Error: Cannot find module '@prisma/client'
```

**Solution:**

- Generate Prisma client: `pnpm db:gen:user`
- Check prisma/generated/client exists
- Run `pnpm install` again

---

**Tài liệu này được tạo tự động bởi Knowledge Capture Assistant**  
**Ngày tạo**: 31/10/2025  
**Phiên bản**: 1.0.0  
**Tác giả**: Hệ thống AI Assistant  
**Mục đích**: Luận văn tốt nghiệp - E-commerce Microservices Platform
