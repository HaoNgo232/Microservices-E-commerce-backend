# Tài Liệu Kỹ Thuật: Cart Microservice

> Tài liệu luận văn tốt nghiệp - Hệ thống E-commerce Microservices  
> Service: Cart App (`apps/cart-app`)  
> Ngày phân tích: 31/10/2025  
> Phạm vi: Quản lý giỏ hàng (cart), đồng bộ với Product Service qua NATS, tính tổng tiền

---

## 📋 Mục Lục

1. [Tổng Quan Microservice](#1-tổng-quan-microservice)
2. [Kiến Trúc & Thiết Kế](#2-kiến-trúc--thiết-kế)
3. [Cơ Sở Dữ Liệu](#3-cơ-sở-dữ-liệu)
4. [Cart Module](#4-cart-module)
5. [CartItem Module](#5-cartitem-module)
6. [NATS Integration & Flows](#6-nats-integration--flows)
7. [Error Handling](#7-error-handling)
8. [Security Model](#8-security-model)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Configuration](#10-deployment--configuration)
11. [Cải Tiến & Mở Rộng](#11-cải-tiến--mở-rộng)
12. [Kết Luận](#12-kết-luận)

---

## 1. Tổng Quan Microservice

### 1.1. Mục Đích và Vai Trò

Cart Microservice quản lý vòng đời giỏ hàng của người dùng:

- Lấy giỏ hàng hiện tại của user (tự động tạo nếu chưa tồn tại)
- Thêm sản phẩm, cập nhật số lượng, xóa sản phẩm khỏi giỏ
- Enrich dữ liệu sản phẩm từ Product Service và tính `totalInt`
- Thiết kế sẵn để có thể hỗ trợ guest cart/merge (qua `sessionId`) trong tương lai

### 1.2. Vị Trí Trong Kiến Trúc

```
Client → Gateway (REST) → NATS Broker → Cart Service ↔ Product Service
                                      │
                                      └─ PostgreSQL (cart_db)
```

### 1.3. Tech Stack

- Framework: NestJS v11.x (NATS microservice)
- Runtime: Node.js v20+
- Language: TypeScript v5.x
- Broker: NATS v2.29 (request/response)
- Database: PostgreSQL v16 (Prisma v6.x)
- Validation: class-validator (Global ValidationPipe)
- Errors: Shared RPC Exceptions + Global RPC Exception Filter

### 1.4. Kết Nối

```
NATS URL: nats://localhost:4222
Queue Group: cart-app
Database URL: postgresql://cart:***@localhost:5435/cart_db
```

---

## 2. Kiến Trúc & Thiết Kế

### 2.1. Layered Architecture (RPC over NATS)

```
┌─────────────────────────────────────────────────────────┐
│                   NATS Transport Layer                   │
│               (Message Pattern Handlers)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Controller Layer                         │
│                     CartController                       │
└────────────────────┬────────────────────────────────────┘
                     │ Delegates business logic
┌────────────────────▼────────────────────────────────────┐
│                  Service Layer                           │
│    CartService        •         CartItemService          │
└────────────────────┬────────────────────────────────────┘
                     │ Prisma Client
┌────────────────────▼────────────────────────────────────┐
│               Data Access Layer (Prisma)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                PostgreSQL Database (cart_db)             │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Bootstrap & Policies

`apps/cart-app/src/main.ts` khởi tạo microservice NATS (queue `cart-app`), bật ValidationPipe toàn cục và Global RPC Exception Filter.

Quyết định thiết kế:

- Queue group cho phép scale-out Cart Service
- Validation ở mức DTO giúp input an toàn
- Exception filter chuẩn hóa lỗi RPC (để Gateway ánh xạ HTTP phù hợp)

### 2.3. Session Strategy

- Nội bộ service sử dụng `sessionId = 'user-' + userId` để định danh giỏ của user.
- Hàm private `getOrCreateCart(userId?: string, sessionId?: string)` tạo giỏ nếu chưa có; tương thích mở rộng guest cart bằng `sessionId` độc lập trong tương lai.

---

## 3. Cơ Sở Dữ Liệu

### 3.1. Prisma Schema (Trích yếu)

`apps/cart-app/prisma/schema.prisma`

```prisma
model Cart {
  id        String    @id @default(cuid())
  sessionId String    @unique
  userId    String?
  items     CartItem[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model CartItem {
  id        String   @id @default(cuid())
  cartId    String
  productId String
  quantity  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  @@unique([cartId, productId])
}
```

### 3.2. Quan Hệ & Quy Ước

- 1 Cart nhiều CartItem; khóa duy nhất `(cartId, productId)` chống trùng
- Xóa cart cascade xóa cart items
- `sessionId` uniquely identifies a cart (hiện dùng quy ước `user-<userId>`)

### 3.3. Gợi Ý Index

- `Cart.sessionId`, `CartItem.cartId`, `CartItem.productId` để tối ưu tra cứu

---

## 4. Cart Module

### 4.1. Event Patterns (NATS)

- `cart.get` → `CartGetDto` → `CartWithProductsResponse`
- `cart.addItem` → `CartAddItemDto` → `CartItemOperationResponse`
- `cart.updateItem` → `CartUpdateItemDto` → `CartItemOperationResponse`
- `cart.removeItem` → `CartRemoveItemDto` → `CartOperationSuccessResponse`

Lưu ý: Shared events định nghĩa thêm `cart.clear` và `cart.merge` nhưng chưa được triển khai trong Cart Service (đề xuất ở mục 11).

### 4.2. Business Logic Highlights (CartService)

- Get: Tạo cart nếu chưa có; enrich items bằng Product Service, tính `totalInt`
- Add: `upsert` item (nếu đã có thì tăng số lượng)
- Update: số lượng = 0 thì xóa item; > 0 thì cập nhật
- Remove: xóa item theo `(cartId, productId)`; trả `{ success: true }` ngay cả khi item không tồn tại (idempotent UX)

### 4.3. Enrichment với Product Service

- Gọi `product.getByIds` (timeout 5s) để lấy `name, priceInt, imageUrls[, stock]`
- Map `items` ↔ `products`; log cảnh báo nếu product không còn tồn tại
- Tổng tiền: `sum(priceInt × quantity)` chỉ cho items có product hợp lệ

---

## 5. CartItem Module

### 5.1. Nghiệp Vụ & Ràng Buộc

- Thêm item: `quantity > 0`, `upsert` theo `(cartId, productId)` và tăng `quantity`
- Cập nhật item: `quantity >= 0`; `0` ⇒ xóa item; không tồn tại ⇒ 404
- Xóa item: idempotent; luôn trả `{ success: true }`

### 5.2. Mẫu Code (Trích yếu)

```ts
// Add
await prisma.cartItem.upsert({
  where: { cartId_productId: { cartId, productId } },
  update: { quantity: { increment: quantity } },
  create: { cartId, productId, quantity },
});

// Update
if (quantity === 0) deleteMany(); else updateMany();
```

---

## 6. NATS Integration & Flows

### 6.1. Gateway ↔ Cart ↔ Product (Get Cart)

```mermaid
sequenceDiagram
  participant Client
  participant Gateway
  participant Cart
  participant Product

  Client->>Gateway: GET /cart (JWT)
  Gateway->>Cart: cart.get { userId }
  Cart->>Cart: getOrCreateCart('user-' + userId)
  alt Cart has items
    Cart->>Product: product.getByIds { ids }
    Product-->>Cart: [ { id, name, priceInt, imageUrls } ]
    Cart->>Cart: enrich + totalInt
  end
  Cart-->>Gateway: { cart, items(with product), totalInt }
  Gateway-->>Client: 200 OK
```

### 6.2. Timeout & Resilience

- `product.getByIds` đặt timeout 5s; nếu timeout ⇒ `503 ServiceUnavailableRpcException`
- Lỗi khác khi gọi Product ⇒ `500 InternalServerRpcException`

---

## 7. Error Handling

- Sử dụng shared RPC exceptions chuẩn hóa:
  - `ValidationRpcException` (400)
  - `EntityNotFoundRpcException` (404)
  - `ServiceUnavailableRpcException` (503)
  - `InternalServerRpcException` (500)
- Global `AllRpcExceptionsFilter` chuyển đổi lỗi đúng định dạng RPC để Gateway ánh xạ sang HTTP

---

## 8. Security Model

- Perimeter security ở Gateway: JWT verify + gắn `userId` vào payload gửi sang Cart Service
- Cart Service không verify JWT; tin cậy Gateway
- Không mở HTTP; chỉ lắng nghe NATS ⇒ giảm bề mặt tấn công

---

## 9. Testing Strategy

- E2E: `apps/cart-app/test/cart.e2e-spec.ts`
  - Tạo cart rỗng khi chưa có
  - Thêm item (bao gồm case thêm lặp tăng số lượng)
  - Cập nhật số lượng (kèm trường hợp không tồn tại)
  - Xóa item (kể cả khi không tồn tại)
  - Mock `product.getByIds` để enrich dữ liệu
- Unit: `CartService`, `CartItemService` logic và mapping

---

## 10. Deployment & Configuration

### 10.1. Biến Môi Trường (trích `.env.example`)

```
NATS_URL=nats://localhost:4222
DATABASE_URL_CART=postgresql://cart:cart_password@localhost:5435/cart_db?schema=public
```

### 10.2. Chạy Service

```
pnpm run start:dev cart-app
pnpm run build cart-app && pnpm run start:prod cart-app
```

---

## 11. Cải Tiến & Mở Rộng

- Guest cart & merge: triển khai `cart.merge` (đã có DTO) để gộp guest items vào user cart khi đăng nhập
- Clear cart: bổ sung `cart.clear` cho use case làm trống giỏ hàng
- Stock validation: optional check tồn kho khi thêm/cập nhật (dựa vào `stock` trả về từ Product Service) để chặn vượt quá tồn kho
- Concurrency: cân nhắc `SELECT ... FOR UPDATE` hoặc atomic operations khi khối lượng lớn
- Caching: cache product snapshot trong quá trình enrich để giảm call tới Product Service

---

## 12. Kết Luận

Cart Microservice hiện thực đầy đủ nghiệp vụ giỏ hàng cốt lõi, phối hợp tốt với Product Service qua NATS để enrich dữ liệu và tính tổng. Thiết kế phân lớp rõ ràng, dùng shared exceptions và global filters cho error handling nhất quán. Các đề xuất (merge guest cart, clear cart, kiểm tra tồn kho) giúp tiến gần hơn tới môi trường production quy mô lớn.

