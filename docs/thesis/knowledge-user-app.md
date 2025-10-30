# Tài Liệu Chi Tiết: User Microservice

> **Tài liệu luận văn** - Phân tích kiến trúc và implementation của User microservice trong hệ thống E-commerce Microservices

---

## 📋 Metadata

| Thông tin            | Giá trị                                |
| -------------------- | -------------------------------------- |
| **Service Name**     | User Microservice (`user-app`)         |
| **Port**             | 3001                                   |
| **Database**         | `user_db` (PostgreSQL port 5433)       |
| **Transport**        | NATS Message Queue                     |
| **Technology Stack** | NestJS, Prisma ORM, bcrypt, jose (JWT) |
| **Ngày phân tích**   | 30/10/2025                             |
| **Độ sâu phân tích** | Toàn bộ service (Level 3)              |

---

## 1. Tổng Quan Service

### 1.1 Mục Đích và Vai Trò

User Microservice là **core service** trong hệ thống, chịu trách nhiệm:

1. **Quản lý User**: CRUD operations cho user accounts
2. **Authentication**: Đăng nhập, đăng ký, JWT token management
3. **Shipping Addresses**: Quản lý địa chỉ giao hàng của users

### 1.2 Vị Trí Trong Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                          API Gateway                             │
│                    (REST API - Port 3000)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ NATS Messages
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      User Microservice                           │
│                         (Port 3001)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Auth Module │  │ Users Module │  │Address Module│          │
│  │              │  │              │  │              │          │
│  │  - Login     │  │  - Create    │  │  - Create    │          │
│  │  - Register  │  │  - Update    │  │  - List      │          │
│  │  - Verify    │  │  - List      │  │  - Update    │          │
│  │  - Refresh   │  │  - Deactive  │  │  - Delete    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│                     ↓ Prisma ORM                                 │
└─────────────────────┴───────────────────────────────────────────┘
                      │
                      ↓
            ┌──────────────────┐
            │  user_db (PG)    │
            │  Port: 5433      │
            │                  │
            │  Tables:         │
            │  - User          │
            │  - Address       │
            └──────────────────┘
```

### 1.3 Business Domain

**User Management Domain** bao gồm:

- **Authentication**: Login/Register với JWT tokens (RSA-based)
- **User Profile**: Quản lý thông tin cá nhân (fullName, phone, email)
- **Address Book**: Quản lý nhiều địa chỉ giao hàng với default address logic
- **Authorization**: Role-based (ADMIN/CUSTOMER)

---

## 2. Cấu Trúc Thư Mục

```
apps/user-app/
├── src/
│   ├── main.ts                    # Bootstrap microservice với NATS
│   ├── user-app.module.ts         # Root module
│   │
│   ├── auth/                      # Authentication module
│   │   ├── auth.controller.ts     # NATS message handlers
│   │   ├── auth.service.ts        # Business logic
│   │   ├── auth.module.ts
│   │   ├── auth.controller.spec.ts
│   │   └── auth.service.spec.ts
│   │
│   ├── users/                     # User management module
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   ├── users.controller.spec.ts
│   │   └── users.service.spec.ts
│   │
│   └── address/                   # Shipping address module
│       ├── address.controller.ts
│       ├── address.service.ts
│       ├── address.module.ts
│       ├── address.controller.spec.ts
│       └── address.service.spec.ts
│
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── prisma.service.ts          # Prisma client service
│   ├── migrations/                # Database migrations
│   └── generated/                 # Generated Prisma client
│       └── client/
│
├── test/                          # E2E tests
│   ├── auth.e2e-spec.ts
│   ├── users.e2e-spec.ts
│   └── address.e2e-spec.ts
│
└── scripts/                       # Utility scripts
    └── create-admin.ts            # Script tạo admin user
```

---

## 3. Database Schema

### 3.1 Prisma Schema Definition

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_USER")
}

generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

enum UserRole {
  ADMIN
  CUSTOMER
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  fullName     String
  phone        String?
  role         UserRole  @default(CUSTOMER)
  isActive     Boolean   @default(true)
  addresses    Address[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Address {
  id        String   @id @default(cuid())
  userId    String
  fullName  String
  phone     String
  street    String
  ward      String
  district  String
  city      String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

### 3.2 Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Address : "has many"

    User {
        string id PK "CUID"
        string email UK "Unique email"
        string passwordHash "bcrypt hash"
        string fullName
        string phone "Optional"
        UserRole role "ADMIN/CUSTOMER"
        boolean isActive "Soft delete flag"
        datetime createdAt
        datetime updatedAt
    }

    Address {
        string id PK "CUID"
        string userId FK
        string fullName "Người nhận"
        string phone "SĐT người nhận"
        string street "Địa chỉ chi tiết"
        string ward "Phường/Xã"
        string district "Quận/Huyện"
        string city "Tỉnh/Thành phố"
        boolean isDefault "Địa chỉ mặc định"
        datetime createdAt
    }
```

### 3.3 Database Design Principles

1. **Isolated Database**: Database riêng biệt, không share với services khác
2. **CUID Primary Keys**: Collision-resistant IDs thay vì auto-increment
3. **Soft Delete**: `isActive` flag thay vì xóa hard
4. **Timestamps**: Tự động track `createdAt` và `updatedAt`
5. **Sensitive Data Protection**: `passwordHash` không bao giờ expose trong responses

---

## 4. Module Architecture

### 4.1 Root Module: UserAppModule

```typescript
@Module({
  imports: [
    JwtModule, // Shared JWT utilities
    TerminusModule, // Health checks
    UsersModule, // User CRUD
    AuthModule, // Authentication
    AddressModule, // Shipping addresses
  ],
  providers: [PrismaService], // Global database access
})
export class UserAppModule {}
```

**Dependency Injection Flow:**

- `PrismaService` được inject vào tất cả services
- `JwtService` từ shared library dùng cho authentication
- Mỗi module hoàn toàn độc lập, giao tiếp qua NATS

### 4.2 Auth Module

**Chức năng chính:**

- Đăng nhập (email/password validation)
- Đăng ký (auto-create CUSTOMER role)
- Verify JWT token
- Refresh token

**NATS Event Patterns:**

```typescript
EVENTS.AUTH.LOGIN; // 'auth.login'
EVENTS.AUTH.REGISTER; // 'auth.register'
EVENTS.AUTH.VERIFY; // 'auth.verify'
EVENTS.AUTH.REFRESH; // 'auth.refresh'
```

**Security Implementation:**

- Password hashing: `bcrypt` với salt rounds = 10
- JWT signing: RSA private key (asymmetric encryption)
- Token expiry: access token (15m), refresh token (7d)

### 4.3 Users Module

**Chức năng chính:**

- CRUD operations cho users
- List users với pagination và search
- Soft delete (deactivate)

**NATS Event Patterns:**

```typescript
EVENTS.USER.CREATE; // 'user.create'
EVENTS.USER.FIND_BY_ID; // 'user.findById'
EVENTS.USER.FIND_BY_EMAIL; // 'user.findByEmail'
EVENTS.USER.UPDATE; // 'user.update'
EVENTS.USER.DEACTIVATE; // 'user.deactivate'
EVENTS.USER.LIST; // 'user.list'
```

**Authorization:**

- CREATE: Admin only (dùng để tạo admin users)
- UPDATE: Owner hoặc Admin
- LIST: Admin only
- DEACTIVATE: Admin only

### 4.4 Address Module

**Chức năng chính:**

- Quản lý shipping addresses
- Default address logic
- Auto-assign default khi xóa

**NATS Event Patterns:**

```typescript
EVENTS.ADDRESS.LIST_BY_USER; // 'address.listByUser'
EVENTS.ADDRESS.CREATE; // 'address.create'
EVENTS.ADDRESS.UPDATE; // 'address.update'
EVENTS.ADDRESS.DELETE; // 'address.delete'
EVENTS.ADDRESS.SET_DEFAULT; // 'address.setDefault'
```

**Business Rules:**

- Địa chỉ đầu tiên tự động là default
- Chỉ có 1 địa chỉ default/user
- Xóa default → auto-assign địa chỉ cũ nhất làm default

---

## 5. Authentication Flow (Chi Tiết)

### 5.1 Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant N as NATS
    participant U as User Service
    participant DB as user_db

    C->>G: POST /auth/login<br/>{email, password}
    G->>G: Validate DTO
    G->>N: send('auth.login', {email, password})
    N->>U: Forward message

    U->>DB: findUnique({email})
    DB-->>U: User record

    alt User không tồn tại
        U-->>N: RpcException(401, Invalid credentials)
        N-->>G: Error
        G-->>C: 401 Unauthorized
    end

    U->>U: bcrypt.compare(password, passwordHash)

    alt Password sai
        U-->>N: RpcException(401, Invalid credentials)
        N-->>G: Error
        G-->>C: 401 Unauthorized
    end

    alt User isActive = false
        U-->>N: RpcException(401, Account deactivated)
        N-->>G: Error
        G-->>C: 401 Unauthorized
    end

    U->>U: Generate JWT tokens<br/>(access + refresh)
    U-->>N: {accessToken, refreshToken}
    N-->>G: Tokens
    G-->>C: 200 OK + tokens
```

### 5.2 JWT Token Structure

**Access Token Payload:**

```typescript
{
  sub: "user_id",           // JOSE standard: subject
  email: "user@example.com",
  role: "CUSTOMER",         // ADMIN or CUSTOMER
  iat: 1698765432,          // Issued at (timestamp)
  exp: 1698766332           // Expires at (iat + 15 minutes)
}
```

**Signing Algorithm:**

- **Algorithm**: RS256 (RSA Signature with SHA-256)
- **Private Key**: RSA 2048-bit từ `keys/private-key.pem`
- **Public Key**: `keys/public-key.pem` (dùng để verify)

**Security Benefits của RSA:**

- Gateway verify token bằng public key (không cần gọi User service)
- Private key chỉ có User service (sign tokens)
- Không thể forge token mà không có private key

### 5.3 Register Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant N as NATS
    participant U as User Service
    participant DB as user_db

    C->>G: POST /auth/register<br/>{email, password, fullName}
    G->>G: Validate DTO
    G->>N: send('auth.register', dto)
    N->>U: Forward message

    U->>DB: findUnique({email})
    DB-->>U: Check existing

    alt Email đã tồn tại
        U-->>N: RpcException(400, Email already exists)
        N-->>G: Error
        G-->>C: 400 Bad Request
    end

    U->>U: Hash password<br/>bcrypt.hash(password, 10)

    U->>DB: create({<br/>  email,<br/>  passwordHash,<br/>  fullName,<br/>  role: CUSTOMER<br/>})
    DB-->>U: New user created

    Note over U: HARDCODE role = CUSTOMER<br/>Không cho phép tự đăng ký ADMIN

    U->>U: Generate JWT tokens
    U-->>N: {accessToken, refreshToken}
    N-->>G: Tokens
    G-->>C: 201 Created + tokens
```

**Security Note:**

- Register endpoint **LUÔN LUÔN** tạo user với role = `CUSTOMER`
- ADMIN users chỉ có thể được tạo qua:
  - Admin panel (gọi `user.create` với explicit role)
  - Script `scripts/create-admin.ts`

---

## 6. Core Business Logic

### 6.1 AuthService: Login Implementation

```typescript
/**
 * Đăng nhập với email và password
 *
 * Flow:
 * 1. Validate user credentials (email, password, isActive)
 * 2. Generate JWT tokens (access + refresh)
 * 3. Trả về tokens (user info có trong JWT payload)
 */
async login(dto: LoginDto): Promise<AuthResponse> {
  try {
    // Step 1: Validate credentials
    const user = await this.validateUserCredentials(dto.email, dto.password);

    // Step 2: Generate tokens
    const tokens = await this.generateTokens({
      sub: user.id,           // JOSE standard claim
      email: user.email,
      role: user.role,
    });

    // Step 3: Return tokens only
    // Client sẽ decode JWT để lấy user info
    return tokens;
  } catch (error) {
    // Error handling với RPC exceptions
    if (error instanceof RpcException) {
      throw error;
    }
    throw new RpcException({
      statusCode: 400,
      message: 'Login failed',
    });
  }
}

/**
 * Validate user credentials
 *
 * Checks:
 * - User exists (email)
 * - Password matches (bcrypt compare)
 * - User is active (not deactivated)
 */
private async validateUserCredentials(
  email: string,
  password: string,
): Promise<User> {
  // Find user by email
  const user = await this.prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new RpcException({
      statusCode: 401,
      message: 'Email hoặc mật khẩu không đúng',
    });
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new RpcException({
      statusCode: 401,
      message: 'Email hoặc mật khẩu không đúng',
    });
  }

  // Check if user is active
  if (!user.isActive) {
    throw new RpcException({
      statusCode: 401,
      message: 'Tài khoản đã bị vô hiệu hóa',
    });
  }

  return user;
}
```

**Key Points:**

1. **Password Security**: Không bao giờ log/expose plain password
2. **Generic Error Messages**: "Email hoặc mật khẩu không đúng" thay vì "Email không tồn tại" (ngăn enumerate users)
3. **isActive Check**: Soft delete - user vẫn tồn tại trong DB nhưng không thể login

### 6.2 UsersService: Create User (Admin)

```typescript
/**
 * Tạo user mới (Admin only)
 *
 * Flow:
 * 1. Validate email chưa tồn tại
 * 2. Hash password bằng bcrypt (salt rounds = 10)
 * 3. Tạo user với role (explicit role từ DTO)
 *
 * Khác với Register:
 * - CREATE cho phép set role (ADMIN/CUSTOMER)
 * - REGISTER luôn tạo CUSTOMER
 */
async create(dto: CreateUserDto): Promise<UserResponse> {
  try {
    // Check email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new RpcException({
        statusCode: 400,
        message: 'Email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role ?? 'CUSTOMER',  // Explicit role hoặc default CUSTOMER
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // KHÔNG select passwordHash
      },
    });

    return user;
  } catch (error) {
    if (error instanceof RpcException) {
      throw error;
    }
    throw new RpcException({
      statusCode: 400,
      message: 'Không thể tạo user',
    });
  }
}
```

**CRITICAL: Prisma Select Pattern**

❌ **WRONG - Exposes passwordHash:**

```typescript
const user = await prisma.user.findUnique({
  where: { id },
});
// Returns ALL fields including passwordHash
```

✅ **CORRECT - Explicit select:**

```typescript
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
```

### 6.3 AddressService: Default Address Logic

```typescript
/**
 * Tạo address mới cho user
 *
 * Business Rules:
 * 1. Địa chỉ đầu tiên TỰ ĐỘNG là default
 * 2. Nếu set isDefault=true → unset tất cả addresses khác
 * 3. Validate user tồn tại trước khi tạo
 */
async create(payload: {
  userId: string;
  dto: AddressCreateDto;
}): Promise<AddressResponse> {
  const { userId, dto } = payload;

  try {
    // Validate user exists
    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new RpcException({
        statusCode: 404,
        message: 'User không tồn tại',
      });
    }

    // Check số lượng addresses hiện có
    const existingAddresses = await this.prisma.address.findMany({
      where: { userId },
    });

    // Rule 1: Địa chỉ đầu tiên tự động là default
    const isFirstAddress = existingAddresses.length === 0;
    const shouldBeDefault = isFirstAddress || dto.isDefault;

    // Rule 2: Nếu set default → unset addresses khác
    if (shouldBeDefault && !isFirstAddress) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Create address
    const newAddress = await this.prisma.address.create({
      data: {
        userId,
        fullName: dto.fullName,
        phone: dto.phone,
        street: dto.street,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
        isDefault: shouldBeDefault,
      },
    });

    return newAddress;
  } catch (error) {
    if (error instanceof RpcException) {
      throw error;
    }
    throw new RpcException({
      statusCode: 400,
      message: 'Không thể tạo địa chỉ',
    });
  }
}
```

**Address Deletion Logic:**

```typescript
/**
 * Xóa address
 *
 * Business Rules:
 * - Nếu xóa address default → auto-assign default mới
 * - Default mới = địa chỉ cũ nhất (oldest createdAt)
 */
async delete(id: string): Promise<{ success: boolean; message: string }> {
  try {
    // Find address to delete
    const address = await this.prisma.address.findUnique({
      where: { id },
    });

    if (!address) {
      throw new RpcException({
        statusCode: 404,
        message: 'Địa chỉ không tồn tại',
      });
    }

    // Delete address
    await this.prisma.address.delete({ where: { id } });

    // If deleted default address → assign new default
    if (address.isDefault) {
      const oldestAddress = await this.prisma.address.findFirst({
        where: { userId: address.userId },
        orderBy: { createdAt: 'asc' },  // Oldest first
      });

      if (oldestAddress) {
        await this.prisma.address.update({
          where: { id: oldestAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return {
      success: true,
      message: 'Xóa địa chỉ thành công',
    };
  } catch (error) {
    if (error instanceof RpcException) {
      throw error;
    }
    throw new RpcException({
      statusCode: 400,
      message: 'Không thể xóa địa chỉ',
    });
  }
}
```

---

## 7. NATS Communication Patterns

### 7.1 Message Pattern Structure

**Controller Pattern:**

```typescript
@Controller() // No REST decorators in microservice
export class UsersController {
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  findById(@Payload() id: string): Promise<UserResponse> {
    return this.usersService.findById(id);
  }
}
```

**Gateway Integration:**

```typescript
// Gateway controller (REST endpoint)
@Controller('users')
export class UsersController {
  constructor(
    @Inject('USER_SERVICE')
    private userClient: ClientProxy,
  ) {}

  @Get(':id')
  @UseGuards(AuthGuard) // Gateway verifies JWT
  async getUser(@Param('id') id: string) {
    return firstValueFrom(
      this.userClient.send(EVENTS.USER.FIND_BY_ID, id).pipe(
        timeout(5000), // 5 second timeout
        retry({ count: 1, delay: 1000 }), // Retry once
      ),
    );
  }
}
```

### 7.2 Request/Response Flow

```mermaid
sequenceDiagram
    participant G as Gateway
    participant N as NATS
    participant U as User Service

    G->>N: send('user.findById', 'user_123')
    N->>U: Route to user-app queue

    U->>U: Process message<br/>@MessagePattern decorator
    U->>U: Execute service method

    alt Success
        U->>N: Return user data
        N->>G: Forward response
    else Error
        U->>N: Throw RpcException
        N->>G: Forward error
        G->>G: Convert to HTTP error
    end
```

### 7.3 Error Handling Pattern

**Microservice throws RpcException:**

```typescript
// In user.service.ts
if (!user) {
  throw new RpcException({
    statusCode: 404,
    message: 'User không tồn tại',
  });
}
```

**Gateway catches and converts:**

```typescript
// AllRpcExceptionsFilter in Gateway
catch(exception: RpcException, host: ArgumentsHost) {
  const ctx = host.switchToHttp();
  const response = ctx.getResponse();
  const error = exception.getError() as any;

  response.status(error.statusCode || 500).json({
    statusCode: error.statusCode || 500,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
}
```

---

## 8. Security Implementation

### 8.1 Perimeter Security Model

**Principle**: Gateway xác thực request, microservices tin tưởng messages từ Gateway.

```
┌────────────────────────────────────────────────┐
│              Security Perimeter                 │
│  ┌──────────────────────────────────────────┐  │
│  │         API Gateway                      │  │
│  │  - Verify JWT với public key            │  │
│  │  - Extract userId từ token              │  │
│  │  - Attach userId vào NATS message       │  │
│  └──────────────┬───────────────────────────┘  │
│                 │ Trusted Zone                  │
│                 ↓                                │
│  ┌──────────────────────────────────────────┐  │
│  │      User Microservice                   │  │
│  │  - NO AuthGuard                          │  │
│  │  - Trust userId from message payload    │  │
│  │  - Process business logic                │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

**Implementation:**

❌ **WRONG - Guard trong microservice:**

```typescript
// DON'T do this in microservice
@Controller()
export class UsersController {
  @UseGuards(AuthGuard) // ❌ Không cần!
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  findById(@Payload() id: string) {}
}
```

✅ **CORRECT - Guard chỉ ở Gateway:**

```typescript
// Gateway controller
@Controller('users')
export class UsersController {
  @UseGuards(AuthGuard) // ✅ Verify JWT ở đây
  @Get(':id')
  async getUser(@Request() req, @Param('id') id: string) {
    // req.user.userId đã được extract từ JWT
    return this.userClient.send(EVENTS.USER.FIND_BY_ID, id);
  }
}
```

### 8.2 Password Security

**Hash Algorithm: bcrypt**

```typescript
import * as bcrypt from 'bcryptjs';

// Hashing (Register/Create)
const passwordHash = await bcrypt.hash(plainPassword, 10);
// Salt rounds = 10 (2^10 = 1024 iterations)

// Verification (Login)
const isValid = await bcrypt.compare(plainPassword, passwordHash);
```

**Security Properties:**

- **Salt**: Mỗi password có salt riêng (ngăn rainbow table attacks)
- **Cost Factor**: 10 = balance giữa security và performance
- **One-way**: Không thể reverse hash thành plain password

### 8.3 JWT Token Security

**RSA Key Generation:**

```bash
# Generate private key (2048-bit)
openssl genrsa -out keys/private-key.pem 2048

# Extract public key
openssl rsa -in keys/private-key.pem -pubout -out keys/public-key.pem
```

**Signing (User Service):**

```typescript
import * as jose from 'jose';

const privateKey = await jose.importPKCS8(
  fs.readFileSync('keys/private-key.pem', 'utf-8'),
  'RS256',
);

const jwt = await new jose.SignJWT({
  sub: userId,
  email: user.email,
  role: user.role,
})
  .setProtectedHeader({ alg: 'RS256' })
  .setIssuedAt()
  .setExpirationTime('15m')
  .sign(privateKey);
```

**Verification (Gateway):**

```typescript
const publicKey = await jose.importSPKI(fs.readFileSync('keys/public-key.pem', 'utf-8'), 'RS256');

const { payload } = await jose.jwtVerify(token, publicKey);
// Tự động check signature và expiry
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Mocking Pattern:**

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
              // Mock Prisma methods
            },
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);
  });

  it('should create user with hashed password', async () => {
    const dto = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    };

    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
    jest.spyOn(prisma.user, 'create').mockResolvedValue({
      id: 'user_123',
      email: dto.email,
      passwordHash: 'hashed',
      fullName: dto.fullName,
      role: 'CUSTOMER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create(dto);

    expect(result.email).toBe(dto.email);
    expect(result).not.toHaveProperty('passwordHash');
  });
});
```

### 9.2 E2E Tests

**Test Setup:**

```typescript
describe('AuthController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        UserAppModule,
        ClientsModule.register([
          {
            name: 'USER_SERVICE_CLIENT',
            transport: Transport.NATS,
            options: {
              servers: ['nats://localhost:4223'], // Test NATS
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.NATS,
      options: { servers: ['nats://localhost:4223'] },
    });

    await app.listen();

    client = moduleFixture.get('USER_SERVICE_CLIENT');
    await client.connect();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    await prisma.$disconnect();
  });

  it('should register user and return tokens', async () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    };

    const result = await firstValueFrom(client.send(EVENTS.AUTH.REGISTER, registerDto));

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});
```

### 9.3 Test Coverage Requirements

| Component   | Target Coverage | Current Status |
| ----------- | --------------- | -------------- |
| Services    | 80%+            | ✅ Đạt         |
| Controllers | 70%+            | ✅ Đạt         |
| Overall     | 75%+            | ✅ Đạt         |

**Run Tests:**

```bash
# Unit tests
pnpm test apps/user-app

# E2E tests
pnpm test:e2e apps/user-app

# Coverage report
pnpm test:cov apps/user-app
```

---

## 10. Configuration & Environment

### 10.1 Environment Variables

```bash
# Database
DATABASE_URL_USER="postgresql://postgres:postgres@localhost:5433/user_db"

# NATS
NATS_URL="nats://localhost:4222"

# JWT Configuration
JWT_EXPIRES_IN="15m"            # Access token expiry
JWT_REFRESH_EXPIRES_IN="7d"    # Refresh token expiry

# Keys
JWT_PRIVATE_KEY_PATH="keys/private-key.pem"
JWT_PUBLIC_KEY_PATH="keys/public-key.pem"
```

### 10.2 Docker Compose Configuration

```yaml
# docker-compose.yml
services:
  user-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: user_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5433:5432'
    volumes:
      - user-db-data:/var/lib/postgresql/data

  user-app:
    build: .
    depends_on:
      - user-db
      - nats
    environment:
      DATABASE_URL_USER: postgresql://postgres:postgres@user-db:5432/user_db
      NATS_URL: nats://nats:4222
    ports:
      - '3001:3001'

volumes:
  user-db-data:
```

---

## 11. Deployment & Operations

### 11.1 Database Migration Workflow

```bash
# 1. Edit schema
vim apps/user-app/prisma/schema.prisma

# 2. Generate Prisma client
pnpm db:gen:all

# 3. Create migration
cd apps/user-app
npx prisma migrate dev --name add_user_phone_field

# 4. Apply to production
npx prisma migrate deploy
```

### 11.2 Health Checks

**Terminus Integration:**

```typescript
import { TerminusModule } from '@nestjs/terminus';

@Module({
  imports: [TerminusModule],
  // Health check endpoints
})
export class UserAppModule {}
```

**Health Check Endpoints:**

- Database connection check
- NATS connection check
- Prisma client status

### 11.3 Monitoring & Logging

**Logging Pattern:**

```typescript
// Success logs
console.log('[AuthService] User logged in:', userId);

// Error logs
console.error('[UsersService] create error:', error);

// NATS message logs
console.log('AuthController.login called with dto:', dto);
```

**Metrics to Monitor:**

- NATS message latency
- Database query performance
- JWT sign/verify time
- Error rate per endpoint

---

## 12. Kiến Trúc Chi Tiết (Cho Luận Văn)

### 12.1 Microservices Principles Applied

1. **Single Responsibility**
   - User service chỉ quản lý: users, auth, addresses
   - Không chứa logic của orders, products, payments

2. **Database per Service**
   - `user_db` isolated, không share với services khác
   - Communication qua NATS, không direct DB access

3. **Asynchronous Communication**
   - NATS message queue cho loose coupling
   - Gateway không biết user service ở đâu

4. **Independent Deployment**
   - Deploy user service riêng mà không ảnh hưởng services khác
   - Database migrations độc lập

### 12.2 Design Patterns Used

#### Repository Pattern (Prisma)

```typescript
// PrismaService acts as repository
@Injectable()
export class PrismaService extends PrismaClient {
  async onModuleInit() {
    await this.$connect();
  }
}

// Service uses repository
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

#### DTO Pattern

```typescript
// Request validation
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}

// Response type safety
export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  // NO passwordHash
}
```

#### Strategy Pattern (JWT)

```typescript
// JwtService abstracts signing/verification
export class JwtService {
  async signJwt(payload: JWTPayload): Promise<string> {}
  async verifyJwt(token: string): Promise<JWTPayload> {}
}

// Services use strategy
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(dto: LoginDto) {
    const tokens = await this.jwtService.signJwt(payload);
    return tokens;
  }
}
```

### 12.3 Trade-offs & Design Decisions

#### Decision 1: Perimeter Security vs Distributed Auth

**Chosen**: Perimeter Security (Gateway authenticates)

**Pros:**

- ✅ Microservices đơn giản hơn (no auth logic)
- ✅ Performance: không cần verify JWT ở mỗi service
- ✅ Centralized security policy

**Cons:**

- ❌ Single point of failure ở Gateway
- ❌ Services tin tưởng hoàn toàn Gateway

**Justification**: Phù hợp cho academic project, internal services đằng sau Gateway.

#### Decision 2: bcrypt vs argon2

**Chosen**: bcrypt

**Pros:**

- ✅ Mature, well-tested algorithm
- ✅ Wide support trong Node.js ecosystem
- ✅ Configurable cost factor

**Cons:**

- ❌ argon2 có security properties tốt hơn
- ❌ bcrypt vulnerable to GPU attacks (mitigated by cost factor)

**Justification**: bcrypt đủ cho use case này, argon2 overkill.

#### Decision 3: RSA vs HMAC for JWT

**Chosen**: RSA (asymmetric)

**Pros:**

- ✅ Gateway verify mà không cần private key
- ✅ Chỉ User service có thể sign tokens
- ✅ Secure key distribution

**Cons:**

- ❌ Slower than HMAC
- ❌ More complex key management

**Justification**: Security > performance, phù hợp microservices architecture.

---

## 13. Lessons Learned & Best Practices

### 13.1 Security Best Practices

1. **NEVER expose passwordHash trong responses**

   ```typescript
   // ✅ ALWAYS use explicit select
   select: {
     id: true,
     email: true,
     // NO passwordHash
   }
   ```

2. **Generic error messages để ngăn user enumeration**

   ```typescript
   // ✅ CORRECT
   throw new RpcException({
     statusCode: 401,
     message: 'Email hoặc mật khẩu không đúng',
   });

   // ❌ WRONG - exposes info
   throw new RpcException({
     statusCode: 401,
     message: 'Email không tồn tại',
   });
   ```

3. **Validate input ở cả Gateway và Microservice**
   - Gateway: User-facing validation
   - Microservice: Defense in depth

### 13.2 Performance Optimization

1. **Database Indexes**

   ```prisma
   model User {
     email String @unique  // Auto-indexed
     // Consider adding index on frequently queried fields
   }
   ```

2. **NATS Timeout & Retry**

   ```typescript
   this.userClient.send(EVENTS.USER.FIND_BY_ID, id).pipe(
     timeout(5000), // Fail fast
     retry({ count: 1, delay: 1000 }), // Single retry
   );
   ```

3. **Prisma Connection Pooling**
   ```typescript
   // Prisma manages connection pool automatically
   // Default: max 10 connections
   ```

### 13.3 Code Quality Practices

1. **Interface-driven development**

   ```typescript
   export interface IUsersService {
     create(dto: CreateUserDto): Promise<UserResponse>;
     // Explicit contracts
   }

   export class UsersService implements IUsersService {
     // Type-safe implementation
   }
   ```

2. **Comprehensive JSDoc**

   ```typescript
   /**
    * Tạo user mới
    *
    * @param dto - CreateUserDto
    * @returns User đã tạo (không bao gồm passwordHash)
    * @throws RpcException nếu email đã tồn tại
    */
   async create(dto: CreateUserDto): Promise<UserResponse> { }
   ```

3. **Error handling pattern**
   ```typescript
   try {
     // Business logic
   } catch (error) {
     if (error instanceof RpcException) {
       throw error; // Re-throw known errors
     }
     // Log and wrap unknown errors
     console.error('[Service] method error:', error);
     throw new RpcException({
       statusCode: 400,
       message: 'Generic error message',
     });
   }
   ```

---

## 14. Future Enhancements

### 14.1 Potential Improvements

1. **Email Verification**
   - Gửi verification email sau register
   - Require email verification trước khi login

2. **Password Reset Flow**
   - Forgot password endpoint
   - Send reset token via email
   - Validate token and update password

3. **OAuth Integration**
   - Login with Google/Facebook
   - Link social accounts to existing users

4. **Multi-factor Authentication (MFA)**
   - TOTP-based (Google Authenticator)
   - SMS-based verification

5. **User Activity Logs**
   - Track login history
   - Suspicious activity detection
   - Account security alerts

### 14.2 Scalability Considerations

1. **Horizontal Scaling**
   - Multiple user service instances
   - NATS queue ensures load balancing
   - Stateless service design

2. **Database Replication**
   - Read replicas cho list/search operations
   - Master-slave setup
   - Connection pooling optimization

3. **Caching Layer**
   - Redis cache cho frequently accessed users
   - JWT blacklist cho logout
   - Cache invalidation strategies

---

## 15. Tài Liệu Tham Khảo

### 15.1 External Documentation

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma ORM Guide](https://www.prisma.io/docs)
- [NATS Messaging](https://docs.nats.io/)
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [bcrypt Algorithm](https://en.wikipedia.org/wiki/Bcrypt)

### 15.2 Internal Documentation

- `docs/AI-ASSISTANT-GUIDE.md` - Development guide
- `docs/QUICK-REFERENCE.md` - Code snippets
- `docs/architecture/SECURITY-ARCHITECTURE.md` - Security model
- `docs/knowledge/RPC-EXCEPTIONS-GUIDE.md` - Error handling

### 15.3 Related Services

- **Gateway** (`apps/gateway`) - REST API entry point
- **Order Service** (`apps/order-app`) - Consumes user data
- **Cart Service** (`apps/cart-app`) - Validates userId

---

## 16. Kết Luận

### 16.1 Điểm Mạnh của User Service

1. **Security-first Design**
   - RSA-based JWT authentication
   - bcrypt password hashing
   - Perimeter security model

2. **Clean Architecture**
   - Separation of concerns (Controller → Service → Repository)
   - DTO validation
   - Interface-driven development

3. **Microservices Best Practices**
   - Isolated database
   - NATS communication
   - Independent deployment

4. **Well-tested**
   - Unit tests với 80%+ coverage
   - E2E tests với real NATS
   - Comprehensive test helpers

### 16.2 Đóng Góp Cho Hệ Thống

User Service là **foundation service** của hệ thống:

- Cung cấp authentication cho tất cả services
- Manage user identity và permissions
- Central point cho user-related data

### 16.3 Phù Hợp Cho Luận Văn

Service này demonstrate:

- ✅ Microservices architecture patterns
- ✅ Message-driven communication
- ✅ Security best practices
- ✅ Database isolation
- ✅ Testing strategies

---

**Tài liệu được tạo ngày**: 30/10/2025  
**Version**: 1.0  
**Tác giả**: AI Assistant  
**Mục đích**: Luận văn tốt nghiệp về Microservices Architecture
