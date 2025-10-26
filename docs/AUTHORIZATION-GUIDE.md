# User Authorization Guide

Hướng dẫn sử dụng Role-based Access Control (RBAC) trong hệ thống e-commerce microservices.

## Tổng Quan

Hệ thống sử dụng **2 layers bảo vệ**:

1. **Authentication** (`AuthGuard`) - Xác thực danh tính qua JWT token
2. **Authorization** (`RolesGuard`) - Phân quyền dựa trên role (ADMIN, CUSTOMER)

## Cấu Trúc

```
Request → AuthGuard (verify JWT) → RolesGuard (check role) → Controller
```

## Cài Đặt

### 1. Import Guards và Decorator

```typescript
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@shared/dto/user.dto';
```

### 2. Apply Guards

```typescript
@Controller('users')
@UseGuards(AuthGuard, RolesGuard) // Both guards required
export class UsersController {
  // ...
}
```

### 3. Thêm @Roles() Decorator

```typescript
// Admin-only endpoint
@Get()
@Roles(UserRole.ADMIN)
async listAllUsers() { ... }

// Both ADMIN và CUSTOMER có thể truy cập
@Get(':id')
@Roles(UserRole.ADMIN, UserRole.CUSTOMER)
async getUserById() { ... }

// Không có @Roles() → chỉ cần authentication
@Get('me')
async getMyProfile() { ... }
```

## Ví Dụ Sử Dụng

### Admin-Only Endpoint

```typescript
@Get()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async listAllUsers(@Query() query: ListUsersDto) {
  return this.send(EVENTS.USER.LIST, query);
}
```

### Customer-Only Endpoint

```typescript
@Post('cart')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
async addToCart(@Body() dto: AddItemDto) {
  return this.send(EVENTS.CART.ADD_ITEM, dto);
}
```

### Multiple Roles Allowed

```typescript
@Get(':id')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CUSTOMER)
async getProduct(@Param('id') id: string) {
  return this.send(EVENTS.PRODUCT.GET_BY_ID, id);
}
```

### Authentication Only (No Role Check)

```typescript
@Get('me')
@UseGuards(AuthGuard, RolesGuard)
async getMyProfile(@Request() req) {
  return this.send(EVENTS.USER.FIND_BY_ID, req.user.userId);
}
```

## Roles

### ADMIN

- Quản lý users (create, update, deactivate, list)
- Quản lý products (create, update, delete)
- Quản lý categories
- Quản lý orders (update status)
- Xem reports

### CUSTOMER

- Xem/sửa profile của mình
- Xem products và categories
- Quản lý cart
- Tạo và xem orders của mình

## Error Responses

### 401 Unauthorized (Authentication Failed)

```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

**Nguyên nhân:**

- Không có `Authorization` header
- Token không hợp lệ
- Token đã hết hạn

### 403 Forbidden (Authorization Failed)

```json
{
  "statusCode": 403,
  "message": "Access denied. Required roles: ADMIN. Your role: CUSTOMER",
  "error": "Forbidden"
}
```

**Nguyên nhân:**

- Token hợp lệ nhưng role không đủ quyền
- User không nằm trong danh sách roles được phép

## Best Practices

### 1. Luôn dùng cả 2 guards

```typescript
// ✅ ĐÚNG
@UseGuards(AuthGuard, RolesGuard)

// ❌ SAI (RolesGuard cần AuthGuard chạy trước)
@UseGuards(RolesGuard)
```

### 2. Thứ tự guards quan trọng

```typescript
// ✅ ĐÚNG - AuthGuard trước, RolesGuard sau
@UseGuards(AuthGuard, RolesGuard)

// ❌ SAI - sai thứ tự
@UseGuards(RolesGuard, AuthGuard)
```

### 3. Explicit better than implicit

```typescript
// ✅ ĐÚNG - Chỉ định rõ roles
@Roles(UserRole.ADMIN)

// ❌ SAI - Không rõ ràng
@Roles(UserRole.CUSTOMER, UserRole.ADMIN) // Làm gì có multiple roles?
```

### 4. Thêm TODO cho ownership checks

```typescript
@Get(':id')
@Roles(UserRole.ADMIN, UserRole.CUSTOMER)
async getUser(@Param('id') id: string, @Request() req) {
  // TODO: Add ownership check (CUSTOMER chỉ xem được profile của mình)
  return this.send(EVENTS.USER.FIND_BY_ID, id);
}
```

## Testing

### Unit Tests

```typescript
describe('RolesGuard', () => {
  it('should allow ADMIN access to admin-only endpoint', () => {
    // Test implementation
  });

  it('should deny CUSTOMER access to admin-only endpoint', () => {
    // Test implementation
  });
});
```

### E2E Tests

```typescript
describe('Authorization (e2e)', () => {
  it('should allow ADMIN to access /users', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('should deny CUSTOMER access to /users', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });
});
```

## Troubleshooting

### 1. Lỗi: "User role not found in token"

**Nguyên nhân:** JWT payload thiếu field `role`

**Giải pháp:** Đảm bảo JWT được sign với đầy đủ fields: `{ sub, email, role }`

### 2. Lỗi: "Access denied" mặc dù role đúng

**Nguyên nhân:** Role trong token không match với @Roles() decorator

**Giải pháp:**

- Kiểm tra role trong JWT payload
- Kiểm tra @Roles() decorator có đúng UserRole enum không

### 3. Guard không chạy

**Nguyên nhân:** Module chưa import AuthModule hoặc chưa có RolesGuard trong providers

**Giải pháp:**

```typescript
@Module({
  imports: [AuthModule], // ← Đảm bảo có import
  // ...
})
```

## Next Steps

- [ ] Thêm ownership checks (CUSTOMER chỉ truy cập được resource của mình)
- [ ] Thêm permission-based authorization (finer-grained control)
- [ ] Thêm logging cho failed authorization attempts
- [ ] Tạo RBAC policies cho từng module

## References

- [NestJS Guards Documentation](https://docs.nestjs.com/guards)
- [Design Document - User Authorization](../ai/design/feature-user-authorization.md)
- [Requirements Document - User Authorization](../ai/requirements/feature-user-authorization.md)
