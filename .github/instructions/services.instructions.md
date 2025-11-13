---
applyTo: 'apps/*/src/**/*.service.ts'
---

# Service Layer Quality Standards

## 🚨 MANDATORY CHECKS FOR ALL SERVICES

### 1. Return Type Enforcement

**EVERY service method MUST have explicit return type.**

```typescript
//  WRONG - Will be flagged
async findById(id: string) {
  return this.prisma.user.findUnique({ where: { id } });
}

//  CORRECT
async findById(id: string): Promise<UserResponse> {
  return this.prisma.user.findUnique({ where: { id } });
}
```

### 2. Error Handling Mandate

**EVERY async method MUST have try-catch.**

```typescript
async create(dto: CreateDto): Promise<Response> {
  try {
    // Validation
    // Operation
    return result;
  } catch (error) {
    if (error instanceof SpecificException) throw error;
    console.error('[ServiceName] create error:', error);
    throw new BadRequestException('Failed to create');
  }
}
```

### 3. Single Responsibility Check

**IF service has methods unrelated to its core purpose → IMMEDIATE ALERT**

```
🚨 SRP VIOLATION
UsersService should only handle user CRUD operations.
Found unrelated method: sendEmail()

💡 Create EmailService instead
```

### 4. Dependency Injection Validation

**NO direct instantiations allowed.**

```typescript
//  WRONG
class UserService {
  private prisma = new PrismaClient(); // FLAG THIS
}

//  CORRECT
class UserService {
  constructor(private readonly prisma: PrismaService) {}
}
```

---

## 🎯 BUSINESS LOGIC PATTERNS

### Validation Before Operation

```typescript
async update(id: string, dto: UpdateDto): Promise<Response> {
  try {
    //  Always check existence first
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Entity ${id} not found`);
    }

    // Then update
    return await this.prisma.update({ where: { id }, data: dto });
  } catch (error) {
    // Proper error handling
  }
}
```

---

## 🔒 SECURITY RULES

### Never Expose Sensitive Fields

```typescript
//  DANGEROUS
async findById(id: string): Promise<User> {
  return prisma.user.findUnique({ where: { id } });
  // Exposes passwordHash!
}

//  SAFE
async findById(id: string): Promise<UserResponse> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      // passwordHash: NEVER include this
    }
  });
}
```

---

## 📊 WHEN SERVICE IS COMPLETE

```
 Service implementation complete!

⏭️ REQUIRED NEXT STEPS:
1. Write unit tests
2. Target: ≥70% coverage
3. Test cases needed:
   □ Happy path (successful operations)
   □ Not found scenarios
   □ Validation errors
   □ Edge cases

Run: npm test -- UserService.spec.ts
```
