# 📝 Quick Reference - E-commerce Microservices

> Tra cứu nhanh commands, patterns và code snippets

## 🚀 Commands

### Setup & Installation

```bash
# Install dependencies
pnpm install

# Generate RSA keys
pnpm generate:keys

# Start Docker
docker compose up -d

# Setup databases
pnpm db:gen:all && pnpm db:migrate:all
```

### Development

```bash
# Start all services
pnpm dev:all

# Start specific service
pnpm nest start --watch gateway
pnpm nest start --watch user-app

# Build
pnpm build:all

# Lint & Format
pnpm lint
pnpm format
```

### Database

```bash
# Generate Prisma clients
pnpm db:gen:all

# Create migration
cd apps/user-app
npx prisma migrate dev --name add_user_avatar

# Run all migrations
pnpm db:migrate:all

# Reset databases (xóa data!)
pnpm db:reset:all

# Prisma Studio
npx prisma studio --schema=apps/user-app/prisma/schema.prisma
```

### Testing

```bash
# Unit tests
pnpm test
pnpm test:watch
pnpm test:cov

# E2E tests
pnpm test:e2e
pnpm test:full

# Specific test file
pnpm test users.service.spec.ts
```

### Docker

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Logs
docker compose logs -f
docker compose logs user_db
docker compose logs nats

# Restart service
docker compose restart nats

# Clean up (xóa volumes)
docker compose down -v
```

---

## 🏗️ Architecture Patterns

### NestJS Module

```typescript
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Microservice Controller (NATS)

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { EVENTS } from '@shared/events';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(EVENTS.USER.FIND_ONE)
  async findOne(@Payload() payload: { userId: string }) {
    return this.usersService.findOne(payload.userId);
  }
}
```

### Gateway Controller (REST)

```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
  async getProfile(@Request() req) {
    return firstValueFrom(
      this.userClient.send(EVENTS.USER.FIND_ONE, { 
        userId: req.user.userId 
      }).pipe(
        timeout(5000),
        retry({ count: 1, delay: 1000 }),
      ),
    );
  }
}
```

### Service

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntityNotFoundRpcException } from '@shared/exceptions';

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
        // ❌ NEVER select passwordHash
      },
    });

    if (!user) {
      throw new EntityNotFoundRpcException('User', userId);
    }

    return user;
  }
}
```

---

## 📦 DTOs

### Create DTO

```typescript
import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;
}
```

### Update DTO

```typescript
import { IsString, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}
```

---

## 🗄️ Prisma Patterns

### Schema

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  firstName    String?
  lastName     String?
  role         UserRole  @default(CUSTOMER)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  addresses    Address[]

  @@map("users")
}
```

### Queries

```typescript
// Find unique with explicit select
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
  },
});

// Find many with filter
const users = await prisma.user.findMany({
  where: {
    role: 'CUSTOMER',
    isActive: true,
  },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0,
});

// Include relations
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    items: {
      include: {
        product: true,
      },
    },
  },
});

// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    passwordHash: await bcrypt.hash(password, 10),
    role: 'CUSTOMER',
  },
  select: {
    id: true,
    email: true,
  },
});

// Update
const user = await prisma.user.update({
  where: { id },
  data: { firstName: 'John' },
  select: {
    id: true,
    firstName: true,
  },
});

// Delete
await prisma.user.delete({
  where: { id },
});

// Transaction
await prisma.$transaction(async (tx) => {
  await tx.order.create({ data: orderData });
  await tx.cart.deleteMany({ where: { userId } });
});
```

---

## 🚨 Error Handling

### RPC Exceptions

```typescript
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
  ConflictRpcException,
  UnauthorizedRpcException,
  ForbiddenRpcException,
} from '@shared/exceptions';

// 404 - Not found
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}

// 400 - Validation error
if (password.length < 8) {
  throw new ValidationRpcException('Mật khẩu phải có ít nhất 8 ký tự');
}

// 409 - Conflict
if (existingEmail) {
  throw new ConflictRpcException('Email đã được sử dụng');
}

// 401 - Unauthorized
if (!isValidPassword) {
  throw new UnauthorizedRpcException('Email hoặc mật khẩu không đúng');
}

// 403 - Forbidden
if (user.role !== 'ADMIN') {
  throw new ForbiddenRpcException('Chỉ admin mới có quyền');
}
```

---

## 🔐 Authentication

### Generate Token

```typescript
import * as jose from 'jose';

const privateKey = await jose.importPKCS8(
  process.env.JWT_PRIVATE_KEY, 
  'RS256'
);

const token = await new jose.SignJWT({
  sub: user.id,
  email: user.email,
  role: user.role,
})
  .setProtectedHeader({ alg: 'RS256' })
  .setExpirationTime('15m')
  .sign(privateKey);
```

### Verify Token

```typescript
const publicKey = await jose.importSPKI(
  process.env.JWT_PUBLIC_KEY, 
  'RS256'
);

const { payload } = await jose.jwtVerify(token, publicKey);
// payload = { sub: 'user-id', email: 'user@example.com', role: 'CUSTOMER' }
```

### AuthGuard

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    
    if (!token) {
      throw new UnauthorizedException('Token không tồn tại');
    }

    const payload = await this.jwtService.verifyToken(token);
    request.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    
    return true;
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
```

---

## 🧪 Testing

### Unit Test

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
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should find user by id', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

    const result = await service.findOne('1');

    expect(result).toEqual(mockUser);
  });

  it('should throw error for non-existent user', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    await expect(service.findOne('invalid')).rejects.toThrow(
      EntityNotFoundRpcException,
    );
  });
});
```

### E2E Test

```typescript
import { expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let client: ClientProxy;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [UserAppModule],
    }).compile();

    app = module.createNestApplication();
    const microservice = app.connectMicroservice({
      transport: Transport.NATS,
      options: { servers: [process.env.NATS_URL] },
    });

    await app.startAllMicroservices();
    await app.init();

    client = app.get('NATS_CLIENT');
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return user by id', async () => {
    const result = await firstValueFrom(
      client.send(EVENTS.USER.FIND_ONE, { userId: 'test-id' }),
    );

    expect(result.id).toBe('test-id');
  });

  it('should throw 404 for non-existent user', async () => {
    await expectRpcErrorWithStatus(
      firstValueFrom(client.send(EVENTS.USER.FIND_ONE, { userId: 'invalid' })),
      404,
      'không tồn tại',
    );
  });
});
```

---

## 🌐 NATS Communication

### Setup Microservice

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
        queue: 'user-app',
      },
    },
  );

  await app.listen();
}
bootstrap();
```

### Setup Gateway Client

```typescript
// app.module.ts
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
    ]),
  ],
})
export class AppModule {}
```

### Send Message

```typescript
// Request-response
return firstValueFrom(
  this.userClient.send(EVENTS.USER.FIND_ONE, { userId }).pipe(
    timeout(5000),
    retry({ count: 1, delay: 1000 }),
  ),
);

// Fire and forget (event)
this.orderClient.emit('order.created', orderData);
```

---

## 🔍 Monitoring & Debug

### NATS Monitoring

```bash
# NATS info
curl http://localhost:8222/varz

# Connections
curl http://localhost:8222/connz

# Subscriptions
curl http://localhost:8222/subsz
```

### Database Access

```bash
# User DB
psql -h localhost -p 5433 -U user -d user_db

# Product DB
psql -h localhost -p 5434 -U product -d product_db

# List tables
\dt

# Describe table
\d users

# Query
SELECT * FROM users LIMIT 10;
```

### Prisma Logs

```typescript
// Enable query logs
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

---

## 📁 File Structure

```
apps/
├── gateway/src/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.guard.ts
│   │   └── auth.module.ts
│   ├── users/
│   │   ├── users.controller.ts
│   │   └── users.module.ts
│   └── main.ts
└── user-app/
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    └── src/
        ├── users/
        │   ├── users.controller.ts
        │   ├── users.service.ts
        │   ├── users.service.spec.ts
        │   └── users.module.ts
        └── main.ts

libs/shared/
├── dto/
├── types/
├── exceptions/
└── events.ts
```

---

## 🎯 Checklist

### Adding New Feature

- [ ] Update Prisma schema
- [ ] Run `pnpm db:gen:all`
- [ ] Create migration
- [ ] Create DTOs in `libs/shared/dto/`
- [ ] Implement service logic
- [ ] Create microservice controller
- [ ] Update gateway controller
- [ ] Write unit tests
- [ ] Write E2E tests
- [ ] Create HTTP test file
- [ ] Update documentation

### Code Review Checklist

- [ ] DTOs có validation đầy đủ?
- [ ] Prisma select explicit (không leak sensitive data)?
- [ ] RPC exceptions đúng type?
- [ ] NATS có timeout & retry?
- [ ] Tests đủ coverage (80%+)?
- [ ] Error messages rõ ràng?
- [ ] Code formatted (`pnpm format`)?
- [ ] No linter errors (`pnpm lint`)?

---

## 📞 Service Ports

| Service | Port | Database Port |
|---------|------|---------------|
| Gateway | 3000 | - |
| User App | 3001 | 5433 |
| Product App | 3002 | 5434 |
| Cart App | 3003 | 5435 |
| Order App | 3004 | 5436 |
| Payment App | 3005 | 5437 |
| AR App | 3006 | 5438 |
| Report App | 3007 | 5439 |
| NATS | 4222 | - |
| NATS Monitor | 8222 | - |

---

## 🔗 Links

- [AI Assistant Guide](./AI-ASSISTANT-GUIDE.md) - Full documentation
- [Setup Guide](../SETUP.md) - Setup instructions
- [Security Architecture](./architecture/SECURITY-ARCHITECTURE.md)
- [RPC Exceptions Guide](./knowledge/RPC-EXCEPTIONS-GUIDE.md)
- [Testing Guide](./knowledge/TESTING.md)

---

**Last Updated:** October 26, 2025

