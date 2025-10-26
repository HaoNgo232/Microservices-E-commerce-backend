# Quick Start - Test Authorization

## 🚀 Hướng dẫn nhanh test authorization

### 1. Khởi động services

```bash
# Terminal 1: NATS
docker-compose up nats -d

# Terminal 2: Gateway
pnpm nest start --watch gateway

# Terminal 3: User Service
pnpm nest start --watch user-app
```

### 2. Mở file test

VS Code: Mở `http/10-authorization-test.http`  
IntelliJ: Mở `http/10-authorization-test.http`

### 3. Chạy test theo thứ tự

#### Step 1: Register users

```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "admin-test@example.com",
  "password": "Admin@123456",
  "fullName": "Admin User"
}
```

```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "customer-test@example.com",
  "password": "Customer@123456",
  "fullName": "Customer User"
}
```

#### Step 2: Login và lấy tokens

```http
# @name loginAdmin
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "admin-test@example.com",
  "password": "Admin@123456"
}
```

Copy `accessToken` từ response.

#### Step 3: Test authorization

✅ Admin can access (should work):

```http
GET http://localhost:3000/users?page=1&pageSize=10
Authorization: Bearer YOUR_ADMIN_TOKEN

# Expected: 200 OK
```

❌ Customer cannot access (should fail):

```http
GET http://localhost:3000/users?page=1&pageSize=10
Authorization: Bearer YOUR_CUSTOMER_TOKEN

# Expected: 403 Forbidden
# {
#   "statusCode": 403,
#   "message": "Access denied. Required roles: ADMIN. Your role: CUSTOMER"
# }
```

❌ No token (should fail):

```http
GET http://localhost:3000/users

# Expected: 401 Unauthorized
# {
#   "statusCode": 401,
#   "message": "Missing authorization header"
# }
```

## 📋 Test Checklist

Checklist để test đầy đủ:

- [ ] Register admin user → Success
- [ ] Register customer user → Success
- [ ] Login admin → Get token
- [ ] Login customer → Get token
- [ ] Admin accesses `/users` → 200 OK
- [ ] Customer accesses `/users` → 403 Forbidden
- [ ] No token accesses `/users` → 401 Unauthorized
- [ ] Invalid token → 401 Unauthorized
- [ ] Admin accesses `/users/:id` → 200 OK
- [ ] Customer accesses `/users/:id` → 200 OK
- [ ] Customer deactivates user → 403 Forbidden
- [ ] Admin deactivates user → 200 OK

## 🎯 Expected Results

### ✅ Should Pass (200 OK)

- Admin → `/users` (list users)
- Admin → `/users/:id` (get user)
- Admin → `/users/email/:email` (find by email)
- Admin → `/users/:id` (update)
- Admin → `/users/:id/deactivate` (deactivate)
- Customer → `/users/:id` (get user)
- Customer → `/users/:id` (update own profile)

### ❌ Should Fail (403 Forbidden)

- Customer → `/users` (list all)
- Customer → `/users/email/:email` (find by email)
- Customer → `/users/:id/deactivate` (deactivate)

### ❌ Should Fail (401 Unauthorized)

- No token → Any protected endpoint
- Invalid token → Any protected endpoint
- Expired token → Any protected endpoint

## 🎨 Using VS Code REST Client

### Install Extension

1. Open VS Code Extensions
2. Search "REST Client"
3. Install (by Huachao Mao)

### Run Requests

1. Open `http/10-authorization-test.http`
2. Click "Send Request" above each request
3. View response in right panel

### Keyboard Shortcuts

- `Ctrl/Cmd + Alt + R` - Run current request
- `Ctrl/Cmd + Alt + L` - Run all requests

## 📊 Status Codes Reference

| Code | Meaning      | Example           |
| ---- | ------------ | ----------------- |
| 200  | Success      | Admin list users  |
| 201  | Created      | Register new user |
| 400  | Bad Request  | Invalid data      |
| 401  | Unauthorized | No/invalid token  |
| 403  | Forbidden    | Wrong role        |
| 404  | Not Found    | User not exists   |
| 409  | Conflict     | Email exists      |
| 408  | Timeout      | Service down      |

## 🐛 Troubleshooting

### Cannot connect to gateway

```bash
# Check if gateway is running
lsof -i :3000

# Check logs
pnpm logs:gateway
```

### Token expired

```bash
# Re-login to get new token
# Token expires in 15 minutes
```

### Services not responding

```bash
# Restart services
docker-compose down
docker-compose up nats -d
pnpm dev:all
```

### Database connection issues

```bash
# Reset database
pnpm db:reset:all

# Run migrations
pnpm db:migrate:all
```

## 📖 Files

- `http/10-authorization-test.http` - Comprehensive tests
- `http/02-users.http` - User management with auth
- `README-AUTHORIZATION-TESTING.md` - Detailed guide

## ⏱️ Estimated Time

- Setup: 2 minutes
- Test all scenarios: 10 minutes
- **Total: ~15 minutes**

## ✅ Success Criteria

Test is successful when:

1. ✅ Can register and login
2. ✅ Admin can access admin-only endpoints
3. ✅ Customer is blocked from admin-only endpoints
4. ✅ Error messages are clear and helpful
5. ✅ All status codes are correct

---

**Happy Testing! 🎉**
