---
applyTo: 'apps/*/src/**/*.controller.ts'
---

# NestJS Controllers Standards

## 🚨 MANDATORY: CONTROLLER RULES

**Controllers should be THIN - just routing to services.**

---

## CONTROLLER STRUCTURE

### Microservice Controller Template

```typescript
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ServiceName } from './service-name.service';
import { EVENTS } from '@shared/events';
import { DtoType } from '@shared/dto/entity.dto';

@Controller()
export class ServiceNameController {
  constructor(private readonly service: ServiceName) {}

  @MessagePattern(EVENTS.ENTITY.ACTION)
  actionName(@Payload() dto: DtoType) {
    return this.service.actionName(dto);
  }
}
```

### Gateway HTTP Controller Template

```typescript
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ServiceName } from './service-name.service';
import { AuthGuard } from './auth.guard';
import { CreateDto, QueryDto } from '@shared/dto/entity.dto';

@Controller('entity')
export class EntityController {
  constructor(private readonly service: ServiceName) {}

  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query() query: QueryDto) {
    return this.service.list(query);
  }
}
```

---

## CONTROLLER BEST PRACTICES

### 1. NO Business Logic

```typescript
//  WRONG - Business logic in controller
@MessagePattern(EVENTS.USER.CREATE)
async create(@Payload() dto: CreateUserDto) {
  const existingUser = await this.prisma.user.findUnique({
    where: { email: dto.email }
  });
  if (existingUser) {
    throw new BadRequestException('Email exists');
  }
  const hash = await bcrypt.hash(dto.password, 10);
  return this.prisma.user.create({ data: { ...dto, passwordHash: hash } });
}

//  CORRECT - Delegate to service
@MessagePattern(EVENTS.USER.CREATE)
create(@Payload() dto: CreateUserDto) {
  return this.service.create(dto);
}
```

### 2. NO Return Type on Controllers

```typescript
//  CORRECT - Controllers don't need return types
@MessagePattern(EVENTS.USER.FIND_BY_ID)
findById(@Payload() id: string) {
  return this.service.findById(id);
}

//  OPTIONAL - But service MUST have return type
async findById(id: string): Promise<UserResponse> { ... }
```

### 3. Use Proper Decorators

```typescript
// Microservices
@MessagePattern(EVENTS.USER.CREATE)  //  NATS message pattern
create(@Payload() dto: CreateUserDto) { ... }

// HTTP Gateway
@Post('users')                       //  HTTP POST
create(@Body() dto: CreateUserDto) { ... }

@Get('users/:id')                    //  Route params
findOne(@Param('id') id: string) { ... }

@Get('users')                        //  Query params
list(@Query() query: ListUsersDto) { ... }
```

---

## 🎯 MESSAGE PATTERN CONVENTIONS

### Event Naming

```typescript
//  CORRECT - Descriptive event names
@MessagePattern(EVENTS.USER.FIND_BY_ID)
@MessagePattern(EVENTS.PRODUCT.GET_BY_SLUG)
@MessagePattern(EVENTS.ORDER.UPDATE_STATUS)

//  WRONG - Generic names
@MessagePattern('find')
@MessagePattern('get')
```

### Payload Patterns

```typescript
//  CORRECT - Single DTO parameter
@MessagePattern(EVENTS.USER.UPDATE)
update(@Payload() payload: { id: string; dto: UpdateUserDto }) {
  return this.service.update(payload.id, payload.dto);
}

//  CORRECT - Simple payload
@MessagePattern(EVENTS.USER.FIND_BY_ID)
findById(@Payload() id: string) {
  return this.service.findById(id);
}
```

---

## AUTHENTICATION PATTERNS

### Protected Routes (Gateway)

```typescript
@Controller('users')
export class UsersController {
  //  CORRECT - Auth guard on protected routes
  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(@Request() req) {
    return this.service.findById(req.user.userId);
  }

  //  CORRECT - Public route (no guard)
  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }
}
```

### Auth in Microservices

```typescript
//  NOTE: Microservices use AuthGuard in service layer
// Controllers just route, guards check in service handlers

@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // No @UseGuards here - handled in service via NATS headers
  @MessagePattern(EVENTS.USER.FIND_BY_ID)
  findById(@Payload() data: { id: string; headers: Record<string, string> }) {
    return this.service.findById(data.id);
  }
}
```

---

## 🚫 ANTI-PATTERNS TO AVOID

### 1. Fat Controllers

```typescript
//  WRONG - Too much logic
@MessagePattern(EVENTS.ORDER.CREATE)
async create(@Payload() dto: OrderCreateDto) {
  // Validation
  if (!dto.items.length) throw new BadRequestException('No items');

  // Calculate total
  let total = 0;
  for (const item of dto.items) {
    const product = await this.productService.findById(item.productId);
    total += product.priceInt * item.quantity;
  }

  // Create order
  const order = await this.prisma.order.create({ ... });

  // Create items
  for (const item of dto.items) {
    await this.prisma.orderItem.create({ ... });
  }

  return order;
}

//  CORRECT - Thin controller
@MessagePattern(EVENTS.ORDER.CREATE)
create(@Payload() dto: OrderCreateDto) {
  return this.service.create(dto);
}
```

### 2. Direct Database Access

```typescript
//  WRONG - Prisma in controller
@MessagePattern(EVENTS.USER.FIND_BY_ID)
async findById(@Payload() id: string) {
  return this.prisma.user.findUnique({ where: { id } });
}

//  CORRECT - Through service
@MessagePattern(EVENTS.USER.FIND_BY_ID)
findById(@Payload() id: string) {
  return this.service.findById(id);
}
```

### 3. Multiple Services in One Handler

```typescript
//  WRONG - Orchestration in controller
@MessagePattern(EVENTS.ORDER.CREATE)
async create(@Payload() dto: OrderCreateDto) {
  const user = await this.userService.findById(dto.userId);
  const address = await this.addressService.findById(dto.addressId);
  const products = await this.productService.findMany(dto.items.map(i => i.productId));
  return this.orderService.createWithDetails(user, address, products, dto);
}

//  CORRECT - Service handles orchestration
@MessagePattern(EVENTS.ORDER.CREATE)
create(@Payload() dto: OrderCreateDto) {
  return this.service.create(dto);  // Service does orchestration
}
```

---

## DEPENDENCY INJECTION

### Constructor Injection

```typescript
//  CORRECT - Inject services via constructor
@Controller()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}
}

//  WRONG - Direct instantiation
@Controller()
export class UsersController {
  private service = new UsersService(); // NO!
}
```

---

## 🎯 ERROR HANDLING

### Let Services Handle Errors

```typescript
//  CORRECT - Service throws, controller propagates
@MessagePattern(EVENTS.USER.FIND_BY_ID)
findById(@Payload() id: string) {
  return this.service.findById(id);  // Service throws NotFoundException
}

//  WRONG - Catch in controller
@MessagePattern(EVENTS.USER.FIND_BY_ID)
async findById(@Payload() id: string) {
  try {
    return await this.service.findById(id);
  } catch (error) {
    throw new NotFoundException('User not found');  // Duplicate error handling
  }
}
```

---

## 📊 AI VALIDATION CHECKLIST

**When user creates/modifies controller, AI MUST CHECK:**

□ No business logic in handler methods
□ No direct Prisma/database calls
□ Proper @MessagePattern or HTTP decorators
□ Single responsibility per handler
□ Proper dependency injection
□ No try-catch (unless specific need)
□ No return types (optional)

**IMMEDIATE FEEDBACK:**

```
🚨 CONTROLLER VIOLATION

Found business logic in controller:
  Line 15: const hash = await bcrypt.hash(dto.password, 10);

💡 Move to service:
  @MessagePattern(EVENTS.USER.CREATE)
  create(@Payload() dto: CreateUserDto) {
    return this.service.create(dto);
  }
```

---

## 🎓 THESIS DEFENSE POINTS

When asked about controllers:

- "Controllers are thin - just routing and delegation"
- "All business logic lives in services for testability"
- "MessagePattern decorators map NATS events to handlers"
- "Dependency injection enables easy mocking in tests"

---

**Remember**: Controllers route, Services work!
