# HTTP Test Files - Hướng Dẫn Sử Dụng

## 📋 Mục đích

Các file HTTP này giúp test nhanh các API endpoints của hệ thống e-commerce microservices cho luận văn.

## 🚀 Cách sử dụng

### 1. Cài đặt Extension

**VS Code:**

- Cài đặt extension: **REST Client** (by Huachao Mao)

**IntelliJ/WebStorm:**

- Tích hợp sẵn HTTP Client

### 2. Khởi động Services

```bash
# Terminal 1: Start NATS
docker-compose up nats

# Terminal 2: Start Gateway
pnpm start:gateway

# Terminal 3-9: Start các microservices
pnpm start:user-app
pnpm start:product-app
pnpm start:cart-app
pnpm start:order-app
pnpm start:payment-app
pnpm start:ar-app
pnpm start:report-app
```

### 3. Thứ tự Test

Chạy các file theo thứ tự:

1. **00-setup.http** - Setup biến môi trường
2. **01-auth.http** - Đăng ký và đăng nhập
3. **02-users.http** - Quản lý users với authorization
4. **10-authorization-test.http** - 🆕 Test chi tiết authorization
5. **03-addresses.http** - Quản lý địa chỉ
6. **04-categories.http** - Quản lý categories
7. **05-products.http** - Quản lý products
8. **06-cart.http** - Giỏ hàng
9. **07-orders.http** - Đặt hàng
10. **08-payments.http** - Thanh toán
11. **09-ar.http** - AR snapshots

**📖 Xem thêm**: `README-AUTHORIZATION-TESTING.md` - Hướng dẫn chi tiết test authorization

## 💡 Tips

### Sử dụng Variables

Các response có thể được lưu và dùng lại:

```http
# @name loginCustomer
POST {{gatewayUrl}}/auth/login
Content-Type: application/json
{
  "email": "customer@test.com",
  "password": "Customer@123456"
}

### Dùng token từ response trên
GET {{gatewayUrl}}/auth/me
Authorization: Bearer {{loginCustomer.response.body.accessToken}}
```

### Keyboard Shortcuts

**VS Code:**

- `Ctrl/Cmd + Alt + R` - Chạy request hiện tại
- `Ctrl/Cmd + Alt + L` - Chạy tất cả requests

**IntelliJ:**

- Click vào icon ▶️ bên cạnh request
- `Ctrl/Cmd + Enter` - Chạy request

## 🔍 Test Scenarios

### Happy Path Flow

1. Register → Login → Get user info
2. Create category → Create product
3. Add product to cart → Create order
4. Process payment → Verify payment

### Error Cases

- Login với sai password (expect 401)
- Tạo product với duplicate SKU (expect 409)
- Access protected endpoint without token (expect 401)
- Cancel shipped order (expect 400)

## 📊 Expected Status Codes

- `200 OK` - Thành công
- `201 Created` - Tạo mới thành công
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Chưa đăng nhập
- `403 Forbidden` - Không có quyền
- `404 Not Found` - Không tìm thấy
- `409 Conflict` - Duplicate data

## 🐛 Troubleshooting

### Services không chạy

```bash
# Check ports
lsof -i :3000  # Gateway
lsof -i :4222  # NATS

# Check logs
docker logs nats
pnpm logs:gateway
```

### Token expired

- Chạy lại login request để lấy token mới
- Token có thời gian sống 15 phút (access) / 7 ngày (refresh)

### Database issues

```bash
# Reset databases
pnpm db:reset:all

# Run migrations
pnpm db:migrate:all
```

## 📚 Documentation

- API Gateway: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- NATS monitoring: `http://localhost:8222`

## 🎯 Cho Luận Văn

Các test cases này demo:

1. **Microservices Architecture** - Mỗi service độc lập
2. **API Gateway Pattern** - Single entry point
3. **Authentication/Authorization** - JWT tokens
4. **CRUD Operations** - Đầy đủ các operations
5. **Business Logic** - Cart, Order, Payment flow
6. **Error Handling** - Consistent error responses

---

**Lưu ý:** Data trong các request đã được hardcode sẵn để dễ đọc và test nhanh!
