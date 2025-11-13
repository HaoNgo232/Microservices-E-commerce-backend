---
applyTo: 'apps/user-app/**/*.ts,apps/product-app/**/*.ts,apps/cart-app/**/*.ts,apps/order-app/**/*.ts,apps/payment-app/**/*.ts,apps/ar-app/**/*.ts,apps/report-app/**/*.ts'
---

# Microservices-Specific Instructions

## Microservice Role

Microservices xử lý business logic:

- Nhận messages từ NATS
- Xử lý business logic
- Tương tác với database riêng (Prisma)
- Trả response qua NATS

## Controller Pattern

Microservice controllers PHẢI:

Sử dụng `@MessagePattern(EVENTS.*)` (NATS patterns)
KHÔNG có guards - tin tưởng Gateway
Nhận data qua `@Payload()` decorator
Throw RPC exceptions (không phải HTTP exceptions)
Validate payload structure

```typescript
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(EVENTS.USER.FIND_ONE)
  async findOne(@Payload() payload: { userId: string }) {
    // No guards - Gateway đã verify
    return this.usersService.findOne(payload.userId);
  }

  @MessagePattern(EVENTS.USER.UPDATE)
  async update(@Payload() payload: { userId: string; data: UpdateUserDto }) {
    return this.usersService.update(payload.userId, payload.data);
  }
}
```

## Service Pattern

Services chứa business logic:

```typescript
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
        //  NEVER select passwordHash
      },
    });

    if (!user) {
      throw new EntityNotFoundRpcException('User', userId);
    }

    return user;
  }
}
```

## Database Access

**CRITICAL**: Mỗi microservice chỉ truy cập database của chính nó.

CORRECT: user-app → user_db
WRONG: user-app → product_db

### Prisma Best Practices

1. **Luôn dùng explicit select**:

```typescript
//  CORRECT
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    // Chỉ select fields cần thiết
  },
});

//  WRONG - exposes all fields
const user = await prisma.user.findUnique({ where: { id } });
```

2. **Transaction cho multi-step operations**:

```typescript
await this.prisma.$transaction(async tx => {
  const order = await tx.order.create({ data: orderData });
  await tx.orderItem.createMany({ data: itemsData });
  return order;
});
```

3. **Handle Prisma errors**:

```typescript
try {
  await this.prisma.user.create({ data });
} catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictRpcException('Email đã tồn tại');
  }
  throw new InternalServerRpcException('Database error', { error: error.message });
}
```

## Error Handling

Sử dụng RPC exceptions (KHÔNG phải HTTP exceptions):

```typescript
import { EntityNotFoundRpcException, ValidationRpcException, ConflictRpcException } from '@shared/exceptions';

// 404
if (!user) {
  throw new EntityNotFoundRpcException('User', userId);
}

// 400
if (dto.email && !isEmail(dto.email)) {
  throw new ValidationRpcException('Email không hợp lệ');
}

// 409
if (existingEmail) {
  throw new ConflictRpcException('Email đã được sử dụng');
}
```

## Main.ts Pattern

Mỗi microservice có main.ts setup NATS:

```typescript
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL || 'nats://localhost:4222'],
      queue: 'user-app', // Unique queue name per service
    },
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  await app.listen();
  console.log(' User microservice is listening on NATS');
}
bootstrap();
```

## Cross-Service Communication

Nếu một microservice cần data từ service khác:

1. **Preferred**: Gateway orchestrates (call multiple services)
2. **Alternative**: Microservice inject NATS client và gọi service khác

```typescript
// If absolutely necessary
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PRODUCT_SERVICE',
        transport: Transport.NATS,
        options: { servers: [process.env.NATS_URL] },
      },
    ]),
  ],
})

// In service
constructor(
  @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
) {}

async getProductDetails(productId: string) {
  return firstValueFrom(
    this.productClient.send('product.findOne', { productId }).pipe(
      timeout(5000),
      retry({ count: 1, delay: 1000 }),
    ),
  );
}
```

## Prisma Schema

Mỗi service có schema riêng trong `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Define models here
```

## Testing Microservices

Unit tests mock Prisma:

```typescript
{
  provide: PrismaService,
  useValue: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}
```

E2E tests use real NATS và test database.

## Security Notes

- Microservices KHÔNG verify JWT (Gateway đã làm)
- Tin tưởng userId từ NATS message payload
- Validate business rules, không phải authentication
- Focus on authorization (user có quyền thao tác không?)
