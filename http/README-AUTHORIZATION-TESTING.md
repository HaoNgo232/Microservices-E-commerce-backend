# Authorization Testing Guide

Hướng dẫn test thủ công cho Role-based Access Control (RBAC).

## Tổng Quan

Hệ thống có 2 loại role:

- **ADMIN**: Quản lý toàn bộ hệ thống
- **CUSTOMER**: Người dùng thông thường

## Files Test

### `http/02-users.http`

Test các endpoint quản lý user với authorization

### `http/10-authorization-test.http`

Test chi tiết authorization với admin và customer tokens

## Cách Sử Dụng

### 1. Chuẩn Bị

```bash
# Start services
pnpm dev:all

# Hoặc chạy từng service
pnpm nest start gateway --watch
pnpm nest start user-app --watch
```

### 2. Register Test Users

Chạy các requests này theo thứ tự:

1. **Register Admin**:

```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "Admin@123456",
  "fullName": "Admin User"
}
```

2. **Register Customer**:

```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "customer@test.com",
  "password": "Customer@123456",
  "fullName": "Customer User"
}
```

### 3. Login và Lấy Tokens

Admin:

```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "Admin@123456"
}
```

Customer:

```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "customer@test.com",
  "password": "Customer@123456"
}
```

Lưu `accessToken` từ response để dùng cho các requests tiếp theo.

### 4. Test Authorization

#### Test 1: Admin Access (Should Pass ✅)

```http
GET http://localhost:3000/users?page=1&pageSize=10
Authorization: Bearer <ADMIN_TOKEN>

# Expected: 200 OK với danh sách users
```

#### Test 2: Customer Access (Should Fail ❌)

```http
GET http://localhost:3000/users?page=1&pageSize=10
Authorization: Bearer <CUSTOMER_TOKEN>

# Expected: 403 Forbidden
# {
#   "statusCode": 403,
#   "message": "Access denied. Required roles: ADMIN. Your role: CUSTOMER",
#   "error": "Forbidden"
# }
```

#### Test 3: No Token (Should Fail ❌)

```http
GET http://localhost:3000/users

# Expected: 401 Unauthorized
# {
#   "statusCode": 401,
#   "message": "Missing authorization header",
#   "error": "Unauthorized"
# }
```

## Test Scenarios

### Scenario 1: Admin Quản Lý Users

✅ **Admin có thể**:

- `GET /users` - List tất cả users
- `GET /users/:id` - Xem chi tiết user
- `GET /users/email/:email` - Tìm user theo email
- `PUT /users/:id` - Update user
- `PUT /users/:id/deactivate` - Vô hiệu hóa user

❌ **Customer không thể**:

- `GET /users` (chỉ admin)
- `GET /users/email/:email` (chỉ admin)
- `PUT /users/:id/deactivate` (chỉ admin)

### Scenario 2: Customer Xem Profile

✅ **Customer có thể**:

- `GET /users/:id` - Xem user profile
- `PUT /users/:id` - Update thông tin của mình

✅ **Admin cũng có thể** làm tất cả customer làm được.

### Scenario 3: Error Messages

Khi không có quyền, response sẽ trả về:

```json
{
  "statusCode": 403,
  "message": "Access denied. Required roles: ADMIN. Your role: CUSTOMER",
  "error": "Forbidden"
}
```

Khi chưa đăng nhập, response sẽ trả về:

```json
{
  "statusCode": 401,
  "message": "Missing authorization header",
  "error": "Unauthorized"
}
```

## Endpoint Authorization Matrix

| Endpoint                    | Admin | Customer | No Token |
| --------------------------- | ----- | -------- | -------- |
| `GET /users`                | ✅    | ❌ 403   | ❌ 401   |
| `GET /users/:id`            | ✅    | ✅       | ❌ 401   |
| `GET /users/email/:email`   | ✅    | ❌ 403   | ❌ 401   |
| `PUT /users/:id`            | ✅    | ✅       | ❌ 401   |
| `PUT /users/:id/deactivate` | ✅    | ❌ 403   | ❌ 401   |

## Quick Test Checklist

- [ ] Register admin user
- [ ] Register customer user
- [ ] Login as admin (save token)
- [ ] Login as customer (save token)
- [ ] Test admin accessing `/users` → 200 OK
- [ ] Test customer accessing `/users` → 403 Forbidden
- [ ] Test accessing without token → 401 Unauthorized
- [ ] Test with invalid token → 401 Unauthorized
- [ ] Verify error messages contain role information
- [ ] Test endpoints that allow both roles

## Tips for Testing

### VS Code REST Client

1. Install "REST Client" extension
2. Open `http/10-authorization-test.http`
3. Click "Send Request" above each request
4. View response in side panel

### Postman Collection

Import requests from HTTP files into Postman for easier testing.

### cURL Commands

```bash
# Test admin access
curl -X GET "http://localhost:3000/users?page=1&pageSize=10" \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"

# Test customer access (should fail)
curl -X GET "http://localhost:3000/users?page=1&pageSize=10" \
  -H "Authorization: Bearer CUSTOMER_TOKEN_HERE"
```

## Troubleshooting

### Issue: Getting 401 but token looks valid

- Check token hasn't expired (15 minutes for access token)
- Use refresh token to get new access token
- Verify `Authorization: Bearer <token>` format

### Issue: Getting 403 with admin token

- Check user role in database is actually `ADMIN`
- Verify token contains correct role claim
- Check if endpoint requires multiple roles

### Issue: Can't register user

- Check email doesn't already exist
- Verify password meets requirements (MinLength: 8)
- Check all required fields present

## Expected Results Summary

| Test Case                 | Token    | Expected Status  | Expected Message               |
| ------------------------- | -------- | ---------------- | ------------------------------ |
| GET /users                | Admin    | 200 OK           | List of users                  |
| GET /users                | Customer | 403 Forbidden    | "Required roles: ADMIN"        |
| GET /users                | None     | 401 Unauthorized | "Missing authorization header" |
| GET /users/:id            | Admin    | 200 OK           | User details                   |
| GET /users/:id            | Customer | 200 OK           | User details                   |
| PUT /users/:id/deactivate | Customer | 403 Forbidden    | "Required roles: ADMIN"        |
