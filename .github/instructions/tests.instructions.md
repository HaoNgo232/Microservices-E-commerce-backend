---
applyTo: '**/*.spec.ts,**/*.e2e-spec.ts'
---

# Testing Instructions

## Test Organization

```
apps/
└── user-app/
    ├── src/
    │   └── users/
    │       ├── users.service.ts
    │       └── users.service.spec.ts    # Unit test (same directory)
    └── test/
        └── users.e2e-spec.ts             # E2E test (test directory)
```

## Unit Tests (`*.spec.ts`)

### Location

Đặt cùng thư mục với file được test.

### Naming Convention

`<filename>.spec.ts`

Example: `users.service.ts` → `users.service.spec.ts`

### Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntityNotFoundRpcException } from '@shared/exceptions';

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
              findMany: jest.fn(),
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      const mockUser = {
        id: 'test-id',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.findOne('test-id');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
        select: expect.any(Object),
      });
    });

    it('should throw EntityNotFoundRpcException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(EntityNotFoundRpcException);
    });
  });

  describe('create', () => {
    it('should create a user', async () => {
      const createDto = {
        email: 'new@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: 'new-id',
        email: createDto.email,
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'create').mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });
});
```

### Best Practices

1. **Test Coverage**: Aim for 80%+ coverage
2. **Test Happy Path**: Test expected behavior
3. **Test Error Cases**: Test error handling
4. **Test Edge Cases**: Boundary conditions, null values, etc.
5. **Mock External Dependencies**: Mock Prisma, NATS clients, etc.
6. **Clear Test Names**: Describe what is being tested
7. **Arrange-Act-Assert**: Structure tests clearly

### Mocking Patterns

**Mock Prisma Service**:

```typescript
{
  provide: PrismaService,
  useValue: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}
```

**Mock NATS Client**:

```typescript
{
  provide: 'USER_SERVICE',
  useValue: {
    send: jest.fn().mockReturnValue(of(mockResponse)),
    emit: jest.fn(),
  },
}
```

**Mock JWT Service**:

```typescript
{
  provide: JwtService,
  useValue: {
    generateToken: jest.fn().mockResolvedValue('mock-token'),
    verifyToken: jest.fn().mockResolvedValue({ sub: 'user-id' }),
  },
}
```

## E2E Tests (`*.e2e-spec.ts`)

### Location

Đặt trong `apps/*/test/` directory.

### Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ClientProxy, Transport, MicroserviceOptions } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserAppModule } from '../src/user-app.module';
import { EVENTS } from '@shared/events';
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let client: ClientProxy;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UserAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const microservice = app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.NATS,
      options: {
        servers: [process.env.NATS_URL || 'nats://localhost:4222'],
      },
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

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } },
    });
  });

  describe('USER.FIND_ONE', () => {
    it('should return user by id', async () => {
      // Arrange: Create test user
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
        },
      });

      // Act: Send NATS message
      const result = await firstValueFrom(client.send(EVENTS.USER.FIND_ONE, { userId: user.id }));

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.passwordHash).toBeUndefined(); // Should not expose
    });

    it('should throw 404 error for non-existent user', async () => {
      await expectRpcErrorWithStatus(
        firstValueFrom(client.send(EVENTS.USER.FIND_ONE, { userId: 'invalid-id' })),
        404,
        'không tồn tại',
      );
    });
  });

  describe('USER.CREATE', () => {
    it('should create a new user', async () => {
      const createDto = {
        email: 'newuser@test.com',
        password: 'password123',
      };

      const result = await firstValueFrom(client.send(EVENTS.USER.CREATE, createDto));

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe(createDto.email);

      // Verify in database
      const userInDb = await prisma.user.findUnique({
        where: { email: createDto.email },
      });
      expect(userInDb).toBeDefined();
    });
  });
});
```

### Test Environment

E2E tests sử dụng:

- Real NATS connection
- Test database (separate from dev database)
- Docker containers (via `docker-compose.test.yml`)

### Running E2E Tests

```bash
# Full E2E test suite
pnpm test:full

# Manual steps
pnpm test:compose:up        # Start test containers
pnpm test:db:migrate        # Run migrations
pnpm test:run               # Run tests
pnpm test:compose:down      # Clean up
```

## Test Helpers

### RPC Error Assertions

```typescript
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

// Check error message contains substring
await expectRpcError(promise, 'User không tồn tại');

// Check status code and message
await expectRpcErrorWithStatus(promise, 404, 'không tồn tại');
```

## Commands

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode
pnpm test:watch

# Run specific test file
pnpm test users.service.spec.ts

# Run E2E tests
pnpm test:e2e

# Full E2E test suite with Docker
pnpm test:full

# Debug tests
pnpm test:debug
```

## Coverage Requirements

- **Target**: 80%+ code coverage
- **Focus on**: Business logic, error handling
- **Exclude**: DTOs, interfaces, types
- **Check coverage**: `pnpm test:cov` → open `coverage/unit/index.html`

## Common Patterns

### Testing Controllers

```typescript
describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
  });

  it('should call service.findOne', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    jest.spyOn(service, 'findOne').mockResolvedValue(mockUser);

    const result = await controller.findOne({ userId: '1' });

    expect(result).toEqual(mockUser);
    expect(service.findOne).toHaveBeenCalledWith('1');
  });
});
```

### Testing Async Operations

```typescript
it('should handle async operation', async () => {
  const promise = service.asyncMethod();

  await expect(promise).resolves.toEqual(expectedResult);
  // or
  await expect(promise).rejects.toThrow(ExpectedException);
});
```

### Testing Transactions

```typescript
it('should rollback on error', async () => {
  jest.spyOn(prisma.$transaction).mockRejectedValue(new Error('DB error'));

  await expect(service.createWithTransaction(dto)).rejects.toThrow();

  // Verify rollback happened
  const count = await prisma.user.count();
  expect(count).toBe(0);
});
```

## Best Practices

- Write tests alongside code (TDD encouraged)
- Test both success and error paths
- Clean up test data after each test
- Use meaningful test descriptions
- Mock external dependencies
- Keep tests isolated and independent
- Use `beforeEach` for common setup
- Use `afterEach` for cleanup
- Test edge cases and boundary conditions
- Verify mock calls with `toHaveBeenCalledWith`
- Don't test implementation details
- Don't write overly complex tests
- Don't skip error case testing
- Don't leave test data in database
