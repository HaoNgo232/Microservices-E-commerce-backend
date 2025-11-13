# RPC Exceptions Quick Reference

## 🎯 When to Use Each Exception

### EntityNotFoundRpcException (404)

**Use when:** Resource doesn't exist in database

```typescript
//  User not found
const user = await this.prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new EntityNotFoundRpcException('User', id);
}

//  Product not found
const product = await this.prisma.product.findUnique({ where: { id } });
if (!product) {
  throw new EntityNotFoundRpcException('Product', id);
}
```

### ValidationRpcException (400)

**Use when:** Input validation fails

```typescript
//  Invalid input format
if (!email.includes('@')) {
  throw new ValidationRpcException('Email không hợp lệ');
}

//  Password too short
if (password.length < 8) {
  throw new ValidationRpcException('Mật khẩu phải có ít nhất 8 ký tự');
}

//  Multiple validation errors
throw new ValidationRpcException('Dữ liệu không hợp lệ', {
  errors: ['Email không hợp lệ', 'Password quá ngắn'],
});
```

### ConflictRpcException (409)

**Use when:** Resource already exists or conflicts with existing data

```typescript
//  Email already exists
const existing = await this.prisma.user.findUnique({ where: { email } });
if (existing) {
  throw new ConflictRpcException('Email đã được sử dụng');
}

//  SKU already exists
const product = await this.prisma.product.findUnique({ where: { sku } });
if (product) {
  throw new ConflictRpcException(`Sản phẩm với SKU ${sku} đã tồn tại`);
}
```

### UnauthorizedRpcException (401)

**Use when:** Authentication fails

```typescript
//  Invalid credentials
const isValid = await bcrypt.compare(password, user.passwordHash);
if (!isValid) {
  throw new UnauthorizedRpcException('Email hoặc mật khẩu không đúng');
}

//  Token expired
if (payload.exp < Date.now() / 1000) {
  throw new UnauthorizedRpcException('Token đã hết hạn');
}
```

### ForbiddenRpcException (403)

**Use when:** User lacks permissions

```typescript
//  Admin-only action
if (user.role !== 'ADMIN') {
  throw new ForbiddenRpcException('Chỉ admin mới có quyền thực hiện thao tác này');
}

//  Resource ownership check
if (order.userId !== currentUserId) {
  throw new ForbiddenRpcException('Bạn không có quyền truy cập đơn hàng này');
}
```

### ServiceUnavailableRpcException (503)

**Use when:** External service is down

```typescript
//  Database connection failed
try {
  await this.prisma.$connect();
} catch (error) {
  throw new ServiceUnavailableRpcException('Không thể kết nối database');
}

//  Payment gateway timeout
if (gatewayResponse.status === 'timeout') {
  throw new ServiceUnavailableRpcException('Cổng thanh toán tạm thời không khả dụng');
}
```

### InternalServerRpcException (500)

**Use when:** Unexpected errors occur

```typescript
//  Unexpected error with context
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

## 🧪 Testing RPC Exceptions

### Basic Error Assertion

```typescript
import { expectRpcError } from '@shared/testing/rpc-test-helpers';

it('should throw error for invalid user', async () => {
  await expectRpcError(firstValueFrom(client.send(EVENTS.USER.GET, 'invalid-id')), 'không tồn tại');
});
```

### Error with Status Code

```typescript
import { expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

it('should return 404 for missing user', async () => {
  await expectRpcErrorWithStatus(firstValueFrom(client.send(EVENTS.USER.GET, 'invalid-id')), 404, 'không tồn tại');
});
```

## 🎨 Best Practices

### DO

```typescript
// Clear, specific error messages
throw new EntityNotFoundRpcException('User', userId);

// Include context in details
throw new ValidationRpcException('Validation failed', {
  fields: ['email', 'password'],
});

// Use appropriate status codes
throw new ConflictRpcException('Email already exists');
```

### DON'T

```typescript
// Generic error message
throw new RpcException('Error');

// Wrong status code
throw new EntityNotFoundRpcException('Unauthorized'); // Should be UnauthorizedRpcException

// Missing context
throw new InternalServerRpcException('Error'); // No details
```

## 🔍 Debugging Tips

### Enable Error Logging

```typescript
// In microservice
async findUser(id: string) {
  try {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new EntityNotFoundRpcException('User', id);
    }
    return user;
  } catch (error) {
    //  Log for debugging
    console.error('[UserService] findUser error:', {
      id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
```

### Test Error Propagation

```typescript
it('should propagate error from service to controller', async () => {
  // Mock service to throw error
  jest.spyOn(service, 'findUser').mockRejectedValue(new EntityNotFoundRpcException('User', 'test-id'));

  // Expect error in controller
  await expectRpcError(firstValueFrom(client.send(EVENTS.USER.GET, 'test-id')), 'không tồn tại');
});
```
