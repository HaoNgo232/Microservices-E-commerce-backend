# Tài Liệu Kỹ Thuật: Order Microservice

> **Tài liệu luận văn tốt nghiệp** - Hệ thống E-commerce Microservices  
> **Service**: Order App (`apps/order-app`)  
> **Ngày phân tích**: 31/10/2025  
> **Phạm vi**: Microservice quản lý đơn hàng, xử lý luồng đặt hàng và tích hợp với Product/Cart services

---

## 📋 Mục Lục

1. [Tổng Quan Microservice](#1-tổng-quan-microservice)
2. [Kiến Trúc và Thiết Kế](#2-kiến-trúc-và-thiết-kế)
3. [Cơ Sở Dữ Liệu](#3-cơ-sở-dữ-liệu)
4. [Order Lifecycle và State Machine](#4-order-lifecycle-và-state-machine)
5. [Business Logic và Workflows](#5-business-logic-và-workflows)
6. [Microservices Integration](#6-microservices-integration)
7. [Transaction Management](#7-transaction-management)
8. [Error Handling](#8-error-handling)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Configuration](#10-deployment--configuration)
11. [Kết Luận và Đánh Giá](#11-kết-luận-và-đánh-giá)

---

## 1. Tổng Quan Microservice

### 1.1. Mục Đích và Vai Trò

**Order Microservice** là một trong những microservices phức tạp nhất trong hệ thống e-commerce, đóng vai trò trung tâm trong luồng mua hàng:

- **Order Management**: Quản lý đơn hàng (tạo, xem, cập nhật, hủy)
- **Order Items Management**: Quản lý chi tiết sản phẩm trong đơn hàng
- **Stock Coordination**: Điều phối tồn kho với Product Service
- **Cart Integration**: Tích hợp với Cart Service để chuyển đổi giỏ hàng thành đơn hàng
- **Payment Integration**: Tích hợp với Payment Service để xử lý thanh toán
- **State Management**: Quản lý trạng thái đơn hàng qua nhiều bước

### 1.2. Vị Trí Trong Kiến Trúc Microservices

```
┌─────────────┐
│   Gateway   │ ◄─── HTTP/REST requests
└──────┬──────┘
       │ NATS
       ▼
┌─────────────────┐
│   NATS Broker   │
└────────┬────────┘
         │
    ┌────┴────────────────────┬──────────────┬──────────────┐
    ▼                         ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐
│ ORDER  │◄─┤ PRODUCT  │  │ CART   │  │ PAYMENT  │  │  USER    │
│  App   │  │   App    │  │  App   │  │   App    │  │  App     │
└───┬────┘  └──────────┘  └────────┘  └──────────┘  └──────────┘
    │             ▲            ▲
    │             │            │
    └─────────────┴────────────┘
    (Order → Product: validate stock, dec/inc stock)
    (Order → Cart: clear cart after order)

    ▼
┌─────────────┐
│ PostgreSQL  │
│  order_db   │
└─────────────┘
```

**Đặc điểm:**

- **Hub Service**: Tương tác với nhiều services (Product, Cart, Payment, User)
- **Orchestrator Role**: Điều phối workflow tạo đơn hàng
- **State Machine**: Quản lý trạng thái phức tạp với validation chuyển đổi

### 1.3. Tech Stack

| Component          | Technology      | Version |
| ------------------ | --------------- | ------- |
| **Framework**      | NestJS          | v11.x   |
| **Runtime**        | Node.js         | v20+    |
| **Language**       | TypeScript      | v5.x    |
| **Message Broker** | NATS            | v2.29   |
| **Database**       | PostgreSQL      | v16     |
| **ORM**            | Prisma          | v6.x    |
| **Validation**     | class-validator | -       |
| **Testing**        | Jest            | v30     |
| **Async Patterns** | RxJS            | v7.x    |

### 1.4. Port Configuration

```
Service Port: 3004
Database Port: 5436
NATS URL: nats://localhost:4222
Queue Group: order-app
```

---

## 2. Kiến Trúc và Thiết Kế

### 2.1. Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                   NATS Transport Layer                   │
│              (Message Pattern Handlers)                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Controller Layer                         │
│  ┌──────────────┐           ┌──────────────┐           │
│  │   Orders     │           │  OrderItem   │           │
│  │ Controller   │           │  Controller  │           │
│  └──────────────┘           └──────────────┘           │
└────────────────────┬────────────────────────────────────┘
                     │ Delegates business logic
┌────────────────────▼────────────────────────────────────┐
│                  Service Layer                           │
│  ┌──────────────┐           ┌──────────────┐           │
│  │   Orders     │           │  OrderItem   │           │
│  │   Service    │           │   Service    │           │
│  └──────┬───────┘           └──────────────┘           │
│         │                                                │
│         │ Orchestrates external calls                   │
│    ┌────┴────────┬─────────────┐                       │
│    ▼             ▼             ▼                        │
│ ┌────────┐  ┌────────┐  ┌────────┐                    │
│ │Product │  │ Cart   │  │Payment │                    │
│ │Client  │  │Client  │  │Client  │                    │
│ └────────┘  └────────┘  └────────┘                    │
└────────────────────┬────────────────────────────────────┘
                     │ Database operations
┌────────────────────▼────────────────────────────────────┐
│               Data Access Layer                          │
│              (Prisma ORM Client)                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                PostgreSQL Database                       │
│                   (order_db)                             │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Module Structure

```typescript
// apps/order-app/src/order-app.module.ts
@Module({
  imports: [
    OrdersModule, // Order management
    OrderItemModule, // Order items management
  ],
  providers: [PrismaService],
})
export class OrderAppModule {}
```

**OrdersModule Configuration:**

```typescript
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PRODUCT_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
          queue: 'product-app',
        },
      },
      {
        name: 'CART_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
          queue: 'cart-app',
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

**Key Design Decisions:**

1. **NATS Client Injection**: Inject PRODUCT_SERVICE và CART_SERVICE clients vào OrdersService
2. **Orchestrator Pattern**: OrdersService điều phối calls tới multiple services
3. **Fire-and-Forget**: Một số operations không chờ response (stock update, cart clear)

### 2.3. Bootstrap Configuration

```typescript
// apps/order-app/src/main.ts
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(OrderAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'order-app', // Load balancing
    },
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
}
```

---

## 3. Cơ Sở Dữ Liệu

### 3.1. Database Schema Design

```prisma
// apps/order-app/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_ORDER")
}

generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

// Order Entity
model Order {
  id            String        @id @default(cuid())
  userId        String        // Foreign key to User (in user-app)
  addressId     String?       // Foreign key to Address (in user-app)
  status        OrderStatus   @default(PENDING)
  paymentStatus PaymentStatus @default(UNPAID)
  totalInt      Int           @default(0)  // Total in cents
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  items         OrderItem[]   // One-to-many relationship
}

// OrderItem Entity
model OrderItem {
  id        String   @id @default(cuid())
  orderId   String
  productId String   // Foreign key to Product (in product-app)
  quantity  Int
  priceInt  Int      // Price snapshot in cents
  createdAt DateTime @default(now())
  order     Order    @relation(fields: [orderId], references: [id])
}

// Order Status Enum
enum OrderStatus {
  PENDING      // Order created, waiting for payment
  PROCESSING   // Payment confirmed, preparing items
  SHIPPED      // Order shipped to customer
  DELIVERED    // Order delivered successfully
  CANCELLED    // Order cancelled
}

// Payment Status Enum
enum PaymentStatus {
  UNPAID       // Payment not yet completed
  PAID         // Payment successful
}
```

### 3.2. Database Design Principles

#### 3.2.1. Foreign Key References (Logical Only)

**CRITICAL**: Order service references data từ User và Product services, nhưng **KHÔNG có foreign key constraints**.

```
Order.userId ──(logical)──> User.id (in user_db)
Order.addressId ──(logical)──> Address.id (in user_db)
OrderItem.productId ──(logical)──> Product.id (in product_db)
```

**Lý do:**

- ✅ **Database Independence**: Mỗi service có database riêng
- ✅ **Loose Coupling**: Không phụ thuộc database schema của services khác
- ✅ **Service Autonomy**: Order service không bị block bởi User/Product database downtime

**Trade-offs:**

- ❌ **No Referential Integrity**: Phải validate ở application layer
- ❌ **Orphaned Records**: Có thể có orders reference users/products đã bị xóa
- ❌ **Data Consistency**: Eventual consistency instead of immediate consistency

#### 3.2.2. Price Snapshot Pattern

**Quan trọng**: OrderItem lưu `priceInt` (price snapshot) thay vì reference Product.priceInt.

```typescript
// ✅ CORRECT - Store price snapshot
{
  productId: 'product-123',
  quantity: 2,
  priceInt: 10000,  // Price at time of order (snapshot)
}

// ❌ WRONG - Reference product price (can change)
{
  productId: 'product-123',
  quantity: 2,
  // No priceInt - would need to join Product table
}
```

**Lý do:**

- ✅ **Immutable Order History**: Order total không thay đổi khi product price thay đổi
- ✅ **Historical Accuracy**: Biết chính xác giá lúc đặt hàng
- ✅ **Service Independence**: Không cần gọi Product Service để calculate total

### 3.3. Entity Relationships

```mermaid
erDiagram
    Order ||--o{ OrderItem : contains

    Order {
        string id PK
        string userId FK_LOGICAL
        string addressId FK_LOGICAL
        OrderStatus status
        PaymentStatus paymentStatus
        int totalInt
        datetime createdAt
        datetime updatedAt
    }

    OrderItem {
        string id PK
        string orderId FK
        string productId FK_LOGICAL
        int quantity
        int priceInt
        datetime createdAt
    }

    User {
        string id PK
        string email
    }

    Address {
        string id PK
        string userId FK
    }

    Product {
        string id PK
        string name
        int priceInt
        int stock
    }

    Order }o..|| User : "references (logical)"
    Order }o..o| Address : "references (logical)"
    OrderItem }o..|| Product : "references (logical)"
```

### 3.4. Database Query Patterns

#### 3.4.1. Transaction with Nested Create

```typescript
// Create order with items in single transaction
const order = await this.prisma.order.create({
  data: {
    userId,
    addressId,
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    totalInt,
    items: {
      create: [
        { productId: 'p1', quantity: 2, priceInt: 10000 },
        { productId: 'p2', quantity: 1, priceInt: 20000 },
      ],
    },
  },
  include: { items: true }, // Return with items
});
```

**Lợi ích:**

- ✅ Atomic operation: Order và OrderItems được tạo cùng lúc
- ✅ Single database round-trip
- ✅ Automatic transaction handling bởi Prisma

#### 3.4.2. Pagination with Count

```typescript
// Parallel queries for pagination
const [orders, total] = await Promise.all([
  this.prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  }),
  this.prisma.order.count({ where: { userId } }),
]);

return {
  orders,
  total,
  page,
  pageSize,
  totalPages: Math.ceil(total / pageSize),
};
```

---

## 4. Order Lifecycle và State Machine

### 4.1. Order Status State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Create Order

    PENDING --> PROCESSING: Payment Confirmed
    PENDING --> CANCELLED: Cancel / Payment Failed

    PROCESSING --> SHIPPED: Items Prepared & Dispatched
    PROCESSING --> CANCELLED: Cancel / Issues Found

    SHIPPED --> DELIVERED: Customer Receives Order

    DELIVERED --> [*]
    CANCELLED --> [*]

    note right of PENDING
        Initial state
        Waiting for payment
    end note

    note right of PROCESSING
        Payment confirmed
        Preparing items
    end note

    note right of SHIPPED
        Order dispatched
        Cannot cancel
    end note

    note right of DELIVERED
        Final state
        Cannot change
    end note

    note right of CANCELLED
        Final state
        Stock restored
    end note
```

### 4.2. Status Transition Rules

**Valid Transitions:**

```typescript
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [], // Terminal state
  [OrderStatus.CANCELLED]: [], // Terminal state
};
```

**Validation Logic:**

```typescript
private validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): void {
  const allowedStatuses = validTransitions[currentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    throw new ValidationRpcException(
      `Invalid transition from ${currentStatus} to ${newStatus}`
    );
  }
}
```

### 4.3. Payment Status Integration

```mermaid
sequenceDiagram
    participant Order
    participant Payment
    participant Product

    Order->>Payment: Create Payment (totalInt)
    Payment-->>Order: Payment Created (UNPAID)

    alt Payment Successful
        Payment->>Order: Update PaymentStatus (PAID)
        Order->>Order: Update Status (PROCESSING)
        Order->>Product: Decrement Stock (fire-and-forget)
    else Payment Failed
        Payment->>Order: Payment Failed
        Order->>Order: Update Status (CANCELLED)
        Note over Order: No stock decrement
    end
```

### 4.4. Cancel Order Flow

```mermaid
flowchart TD
    A[Cancel Request] --> B{Check Order Status}

    B -->|CANCELLED| C[Throw ConflictException]
    B -->|SHIPPED| D[Throw ValidationException]
    B -->|DELIVERED| D

    B -->|PENDING or PROCESSING| E[Update Status to CANCELLED]

    E --> F[Restore Product Stock]
    F --> G[Fire-and-Forget: product.incrementStock]

    G --> H[Return Cancelled Order]

    style C fill:#f88
    style D fill:#f88
    style H fill:#8f8
```

---

## 5. Business Logic và Workflows

### 5.1. Create Order Workflow

**End-to-End Flow:**

```mermaid
sequenceDiagram
    participant Gateway
    participant Order
    participant Product
    participant Cart
    participant DB

    Gateway->>Order: order.create {userId, items, addressId}

    Note over Order: Step 1: Validate items not empty

    Order->>Product: product.getByIds {ids: [productIds]}
    Product-->>Order: [Product...]

    Note over Order: Step 2: Validate all products exist
    Note over Order: Step 3: Validate sufficient stock

    Note over Order: Step 4: Calculate total

    Order->>DB: Create Order + OrderItems (transaction)
    DB-->>Order: Order created

    Note over Order: Step 5: Decrement stock (fire-and-forget)
    Order--)Product: product.decrementStock (async)

    Note over Order: Step 6: Clear cart (fire-and-forget)
    Order--)Cart: cart.clear {userId} (async)

    Order-->>Gateway: OrderResponse
```

**Implementation:**

```typescript
async create(dto: OrderCreateDto): Promise<OrderResponse> {
  // Step 1: Validate items
  if (!dto.items || dto.items.length === 0) {
    throw new ValidationRpcException('Order must contain at least one item');
  }

  // Step 2-3: Validate products and stock
  await this.validateProductsAndStock(dto.items);

  // Step 4: Calculate total
  const totalInt = dto.items.reduce(
    (sum, item) => sum + item.priceInt * item.quantity,
    0
  );

  // Step 5: Create order with items (atomic)
  const order = await this.prisma.order.create({
    data: {
      userId: dto.userId,
      addressId: dto.addressId,
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
      totalInt,
      items: {
        create: dto.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          priceInt: item.priceInt,
        })),
      },
    },
    include: { items: true },
  });

  // Step 6-7: Fire-and-forget async operations
  this.decrementProductStock(dto.items);
  this.clearUserCart(dto.userId);

  return order as OrderResponse;
}
```

### 5.2. Validate Products and Stock

**Critical Validation Logic:**

```typescript
private async validateProductsAndStock(
  items: Array<{ productId: string; quantity: number }>
): Promise<void> {
  // Fetch products from product-service
  const productIds = items.map(item => item.productId);

  const products = await firstValueFrom(
    this.productClient
      .send<ProductResponse[], { ids: string[] }>(
        EVENTS.PRODUCT.GET_BY_IDS,
        { ids: productIds }
      )
      .pipe(
        timeout(5000),  // 5s timeout
        catchError(error => {
          console.error('[OrdersService] Error fetching products:', error);
          if (error.name === 'TimeoutError') {
            return throwError(
              () => new ValidationRpcException('Product service không phản hồi')
            );
          }
          return throwError(
            () => new ValidationRpcException('Failed to validate products')
          );
        }),
      ),
  );

  // Validate all products found
  if (products.length !== productIds.length) {
    const foundIds = new Set(products.map(p => p.id));
    const missingIds = productIds.filter(id => !foundIds.has(id));
    throw new ValidationRpcException(
      `Products not found: ${missingIds.join(', ')}`
    );
  }

  // Validate sufficient stock for each item
  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) {
      throw new ValidationRpcException(`Product ${item.productId} not found`);
    }

    if (product.stock < item.quantity) {
      throw new ValidationRpcException(
        `Insufficient stock for ${product.name}. ` +
        `Available: ${product.stock}, Requested: ${item.quantity}`
      );
    }
  }
}
```

**Error Scenarios:**

1. **Product Service Timeout**: Throw ValidationRpcException với message rõ ràng
2. **Products Not Found**: List missing product IDs
3. **Insufficient Stock**: Show available vs requested quantity

### 5.3. Update Order Status

**Implementation:**

```typescript
async updateStatus(dto: OrderUpdateStatusDto): Promise<OrderResponse> {
  // Check order exists
  const existingOrder = await this.prisma.order.findUnique({
    where: { id: dto.id },
    include: { items: true },
  });

  if (!existingOrder) {
    throw new EntityNotFoundRpcException('Order', dto.id);
  }

  // Validate status transition
  this.validateStatusTransition(existingOrder.status, dto.status);

  // Update order status
  const updatedOrder = await this.prisma.order.update({
    where: { id: dto.id },
    data: {
      status: dto.status,
      updatedAt: new Date(),
    },
    include: { items: true },
  });

  // If cancelled, restore stock (fire-and-forget)
  if (dto.status === OrderStatus.CANCELLED) {
    this.restoreProductStock(existingOrder.items);
  }

  return updatedOrder as OrderResponse;
}
```

### 5.4. Cancel Order

**Business Rules:**

- ✅ Can cancel: PENDING, PROCESSING
- ❌ Cannot cancel: SHIPPED, DELIVERED, already CANCELLED

```typescript
async cancel(dto: OrderCancelDto): Promise<OrderResponse> {
  const existingOrder = await this.prisma.order.findUnique({
    where: { id: dto.id },
    include: { items: true },
  });

  if (!existingOrder) {
    throw new EntityNotFoundRpcException('Order', dto.id);
  }

  // Validate cancellation is allowed
  if (existingOrder.status === OrderStatus.CANCELLED) {
    throw new ConflictRpcException('Order is already cancelled');
  }

  if (existingOrder.status === OrderStatus.SHIPPED) {
    throw new ValidationRpcException('Cannot cancel shipped orders');
  }

  // Update to cancelled
  const cancelledOrder = await this.prisma.order.update({
    where: { id: dto.id },
    data: {
      status: OrderStatus.CANCELLED,
      updatedAt: new Date(),
    },
    include: { items: true },
  });

  // Restore product stock (fire-and-forget)
  this.restoreProductStock(existingOrder.items);

  return cancelledOrder as OrderResponse;
}
```

---

## 6. Microservices Integration

### 6.1. Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Order Service                         │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          OrdersService                          │    │
│  │                                                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │
│  │  │ Product  │  │   Cart   │  │ Payment  │    │    │
│  │  │  Client  │  │  Client  │  │  Client  │    │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘    │    │
│  └───────┼─────────────┼─────────────┼───────────┘    │
│          │             │             │                  │
└──────────┼─────────────┼─────────────┼──────────────────┘
           │             │             │
           │  NATS       │  NATS       │  NATS
           ▼             ▼             ▼
    ┌───────────┐  ┌─────────┐  ┌──────────┐
    │ Product   │  │  Cart   │  │ Payment  │
    │  Service  │  │ Service │  │ Service  │
    └───────────┘  └─────────┘  └──────────┘
```

### 6.2. Product Service Integration

**Messages Sent:**

| Event Pattern            | Payload                 | Purpose                  | Response Pattern |
| ------------------------ | ----------------------- | ------------------------ | ---------------- |
| `product.getByIds`       | `{ids: string[]}`       | Validate products exist  | Request-Response |
| `product.decrementStock` | `{productId, quantity}` | Reduce stock after order | Fire-and-Forget  |
| `product.incrementStock` | `{productId, quantity}` | Restore stock on cancel  | Fire-and-Forget  |

**Request-Response Pattern:**

```typescript
// Synchronous call with timeout and error handling
const products = await firstValueFrom(
  this.productClient
    .send<ProductResponse[], { ids: string[] }>(EVENTS.PRODUCT.GET_BY_IDS, { ids: productIds })
    .pipe(
      timeout(5000),
      catchError(error => {
        console.error('[OrdersService] Product service error:', error);
        return throwError(() => new ValidationRpcException('Failed to validate products'));
      }),
    ),
);
```

**Fire-and-Forget Pattern:**

```typescript
// Asynchronous call, don't wait for response
private decrementProductStock(
  items: Array<{ productId: string; quantity: number }>
): void {
  for (const item of items) {
    firstValueFrom(
      this.productClient
        .send(EVENTS.PRODUCT.DEC_STOCK, {
          productId: item.productId,
          quantity: item.quantity,
        })
        .pipe(
          timeout(5000),
          catchError(error => {
            console.error(
              `Failed to decrement stock for product ${item.productId}:`,
              error
            );
            return of(null);  // Swallow error
          }),
        ),
    ).catch(() => {
      // Ignore errors for fire-and-forget
    });
  }
}
```

**Tại sao Fire-and-Forget?**

- ✅ **Non-blocking**: Create order thành công ngay, không chờ stock update
- ✅ **Resilience**: Nếu Product service down, order vẫn được tạo
- ✅ **Performance**: Giảm latency cho user
- ❌ **Eventual Consistency**: Stock có thể chưa updated ngay lập tức
- ❌ **No Rollback**: Nếu stock update fail, cần compensation logic

### 6.3. Cart Service Integration

**Messages Sent:**

| Event Pattern | Payload            | Purpose                | Response Pattern |
| ------------- | ------------------ | ---------------------- | ---------------- |
| `cart.clear`  | `{userId: string}` | Clear cart after order | Fire-and-Forget  |

**Implementation:**

```typescript
private clearUserCart(userId: string): void {
  firstValueFrom(
    this.cartClient
      .send(EVENTS.CART.CLEAR, { userId })
      .pipe(
        timeout(5000),
        catchError(error => {
          console.error(`Failed to clear cart for user ${userId}:`, error);
          return of(null);  // Swallow error
        }),
      ),
  ).catch(() => {
    // Ignore errors for fire-and-forget
  });
}
```

**Lý do Clear Cart:**

- User đã chuyển items từ cart sang order
- Tránh duplicate items nếu user order lại
- Best practice trong e-commerce UX

### 6.4. Payment Service Integration

**Integration Flow:**

```mermaid
sequenceDiagram
    participant Gateway
    participant Order
    participant Payment

    Note over Gateway: User clicks "Checkout"

    Gateway->>Order: order.create
    Order-->>Gateway: Order (PENDING, UNPAID)

    Gateway->>Payment: payment.create {orderId, totalInt}
    Payment-->>Gateway: Payment URL

    Note over Gateway: User completes payment

    Payment->>Order: order.updatePaymentStatus {orderId, PAID}
    Order-->>Payment: Order updated

    Order->>Order: Auto-update status to PROCESSING
```

**Implementation:**

```typescript
async updatePaymentStatus(
  dto: OrderUpdatePaymentStatusDto
): Promise<OrderResponse> {
  const order = await this.prisma.order.findUnique({
    where: { id: dto.id },
    include: { items: true },
  });

  if (!order) {
    throw new EntityNotFoundRpcException('Order', dto.id);
  }

  const updatedOrder = await this.prisma.order.update({
    where: { id: dto.id },
    data: {
      paymentStatus: dto.paymentStatus,
      updatedAt: new Date(),
    },
    include: { items: true },
  });

  console.log(
    `[OrdersService] Updated order ${dto.id} paymentStatus to ${dto.paymentStatus}`
  );

  return updatedOrder as OrderResponse;
}
```

---

## 7. Transaction Management

### 7.1. Local Transactions (Prisma)

**Order Creation Transaction:**

```typescript
// Atomic: Order + OrderItems created together
const order = await this.prisma.order.create({
  data: {
    userId,
    addressId,
    totalInt,
    status: OrderStatus.PENDING,
    items: {
      create: [
        { productId: 'p1', quantity: 2, priceInt: 10000 },
        { productId: 'p2', quantity: 1, priceInt: 20000 },
      ],
    },
  },
  include: { items: true },
});
```

**Prisma Transaction Guarantees:**

- ✅ **Atomicity**: Tất cả operations thành công hoặc tất cả fail
- ✅ **Consistency**: Database luôn ở trạng thái consistent
- ✅ **Isolation**: Transactions không ảnh hưởng lẫn nhau
- ✅ **Durability**: Committed data được persist

### 7.2. Distributed Transactions Challenge

**Problem:**

```
Order Service              Product Service
     │                           │
     ├─ Create Order             │
     │  (SUCCESS) ✓              │
     │                           │
     ├─ Decrement Stock ────────►│
     │                           ├─ Update Stock
     │                           │  (FAILURE) ✗
     │                           │
     │  ◄── What happens now? ───┤
     │                           │
     ?  Rollback order?          ?
```

**Current Approach: Fire-and-Forget với Logging**

```typescript
private decrementProductStock(items): void {
  for (const item of items) {
    firstValueFrom(
      this.productClient.send(EVENTS.PRODUCT.DEC_STOCK, item).pipe(
        timeout(5000),
        catchError(error => {
          // LOG ERROR for manual intervention
          console.error(
            `[CRITICAL] Failed to decrement stock for product ${item.productId}:`,
            error
          );
          // Could emit to monitoring system
          return of(null);
        }),
      ),
    ).catch(() => {});
  }
}
```

**Trade-offs:**

- ✅ **Simple**: Không cần phức tạp distributed transaction protocol
- ✅ **Fast**: Không block user flow
- ✅ **Resilient**: Failure trong 1 service không break entire flow
- ❌ **Eventual Consistency**: Data có thể inconsistent tạm thời
- ❌ **Manual Reconciliation**: Cần process để fix inconsistencies

### 7.3. Saga Pattern (Future Enhancement)

**Recommended Pattern: Choreography-based Saga**

```mermaid
sequenceDiagram
    participant Order
    participant Product
    participant Payment
    participant EventBus

    Order->>EventBus: OrderCreated Event
    EventBus->>Product: Consume OrderCreated
    Product->>Product: Reserve Stock
    Product->>EventBus: StockReserved Event

    EventBus->>Payment: Consume StockReserved
    Payment->>Payment: Process Payment

    alt Payment Success
        Payment->>EventBus: PaymentCompleted Event
        EventBus->>Product: Consume PaymentCompleted
        Product->>Product: Commit Stock Reduction
        Product->>EventBus: StockReduced Event

        EventBus->>Order: Consume StockReduced
        Order->>Order: Update Status (PROCESSING)
    else Payment Failed
        Payment->>EventBus: PaymentFailed Event
        EventBus->>Product: Consume PaymentFailed
        Product->>Product: Release Reserved Stock

        EventBus->>Order: Consume PaymentFailed
        Order->>Order: Update Status (CANCELLED)
    end
```

**Benefits of Saga:**

- ✅ **Eventual Consistency Guarantee**: All services eventually reach consistent state
- ✅ **Compensation Logic**: Automatic rollback on failure
- ✅ **Audit Trail**: Event history provides full traceability
- ❌ **Complexity**: Requires event sourcing infrastructure
- ❌ **Debugging**: Harder to debug distributed flows

### 7.4. Idempotency

**Problem: Duplicate Messages**

```
Client → Gateway → NATS → Order Service
                     ↓ (retry due to timeout)
                   NATS → Order Service (DUPLICATE!)
```

**Solution: Idempotent Operations**

```typescript
async create(dto: OrderCreateDto): Promise<OrderResponse> {
  // Check if order already exists (by idempotency key)
  const existingOrder = await this.prisma.order.findFirst({
    where: {
      userId: dto.userId,
      // Could use idempotencyKey field
      createdAt: { gte: new Date(Date.now() - 60000) }, // Last 1 minute
    },
  });

  if (existingOrder && this.isSameOrder(existingOrder, dto)) {
    console.log(`[OrdersService] Returning existing order ${existingOrder.id}`);
    return existingOrder as OrderResponse;
  }

  // Create new order
  return this.createNewOrder(dto);
}
```

---

## 8. Error Handling

### 8.1. Error Types và HTTP Status Mapping

| Error Type                       | HTTP Status | Use Case                                                   |
| -------------------------------- | ----------- | ---------------------------------------------------------- |
| `EntityNotFoundRpcException`     | 404         | Order không tồn tại                                        |
| `ValidationRpcException`         | 400         | Items empty, invalid status transition, insufficient stock |
| `ConflictRpcException`           | 409         | Order already cancelled                                    |
| `ServiceUnavailableRpcException` | 503         | Product service timeout                                    |
| `InternalServerRpcException`     | 500         | Unexpected errors                                          |

### 8.2. Error Handling Examples

**Entity Not Found:**

```typescript
const order = await this.prisma.order.findUnique({
  where: { id: dto.id },
});

if (!order) {
  throw new EntityNotFoundRpcException('Order', dto.id);
}
// → "Order với ID 'abc123' không tồn tại"
```

**Validation Error:**

```typescript
if (!dto.items || dto.items.length === 0) {
  throw new ValidationRpcException('Order must contain at least one item');
}

if (product.stock < item.quantity) {
  throw new ValidationRpcException(
    `Insufficient stock for ${product.name}. ` +
      `Available: ${product.stock}, Requested: ${item.quantity}`,
  );
}
```

**Conflict Error:**

```typescript
if (existingOrder.status === OrderStatus.CANCELLED) {
  throw new ConflictRpcException('Order is already cancelled');
}
```

**Service Unavailable:**

```typescript
const products = await firstValueFrom(
  this.productClient.send(EVENTS.PRODUCT.GET_BY_IDS, { ids }).pipe(
    timeout(5000),
    catchError(error => {
      if (error.name === 'TimeoutError') {
        return throwError(
          () => new ServiceUnavailableRpcException('Product service không phản hồi'),
        );
      }
      return throwError(() => error);
    }),
  ),
);
```

### 8.3. Error Propagation Flow

```mermaid
sequenceDiagram
    participant Gateway
    participant Order
    participant Product

    Gateway->>Order: order.create
    Order->>Product: product.getByIds

    alt Product Service Timeout
        Product--xOrder: TimeoutError
        Order->>Order: Catch & Transform
        Order-->>Gateway: ServiceUnavailableRpcException
        Gateway-->>Client: 503 Service Unavailable
    else Product Not Found
        Product-->>Order: Empty array
        Order->>Order: Validate & Throw
        Order-->>Gateway: ValidationRpcException
        Gateway-->>Client: 400 Bad Request
    else Success
        Product-->>Order: [Products]
        Order-->>Gateway: OrderResponse
        Gateway-->>Client: 200 OK
    end
```

---

## 9. Testing Strategy

### 9.1. Unit Testing

**Mock External Services:**

```typescript
describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let productClient: ClientProxy;
  let cartClient: ClientProxy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            order: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: 'PRODUCT_SERVICE',
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: 'CART_SERVICE',
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    prisma = module.get(PrismaService);
    productClient = module.get('PRODUCT_SERVICE');
    cartClient = module.get('CART_SERVICE');
  });

  describe('create', () => {
    it('should create order successfully', async () => {
      // Mock product validation
      jest
        .spyOn(productClient, 'send')
        .mockReturnValue(of([{ id: 'p1', name: 'Product 1', stock: 100, priceInt: 10000 }]));

      // Mock order creation
      const mockOrder = {
        id: 'order-123',
        userId: 'user-123',
        totalInt: 20000,
        items: [{ productId: 'p1', quantity: 2, priceInt: 10000 }],
      };
      jest.spyOn(prisma.order, 'create').mockResolvedValue(mockOrder);

      const result = await service.create({
        userId: 'user-123',
        items: [{ productId: 'p1', quantity: 2, priceInt: 10000 }],
      });

      expect(result.id).toBe('order-123');
      expect(result.totalInt).toBe(20000);
    });

    it('should throw ValidationRpcException when items empty', async () => {
      await expect(service.create({ userId: 'user-123', items: [] })).rejects.toThrow(
        ValidationRpcException,
      );
    });

    it('should throw ValidationRpcException when insufficient stock', async () => {
      jest
        .spyOn(productClient, 'send')
        .mockReturnValue(of([{ id: 'p1', stock: 1, priceInt: 10000 }]));

      await expect(
        service.create({
          userId: 'user-123',
          items: [{ productId: 'p1', quantity: 10, priceInt: 10000 }],
        }),
      ).rejects.toThrow(ValidationRpcException);
    });
  });
});
```

### 9.2. E2E Testing

**Full Integration Test:**

```typescript
describe('OrdersController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

  // Mock external services
  const mockProductClient = {
    send: jest.fn(),
  };
  const mockCartClient = {
    send: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [OrderAppModule, ClientsModule.register([...])],
    })
      .overrideProvider('PRODUCT_SERVICE')
      .useValue(mockProductClient)
      .overrideProvider('CART_SERVICE')
      .useValue(mockCartClient)
      .compile();

    app = module.createNestMicroservice({
      transport: Transport.NATS,
      options: { servers: ['nats://localhost:4223'] },
    });

    await app.listen();
    client = module.get('ORDER_SERVICE_CLIENT');
    prisma = module.get(PrismaService);
    await client.connect();
  });

  it('should create order with items', async () => {
    // Setup mocks
    mockProductClient.send.mockReturnValue(
      of([{ id: 'p1', stock: 100, priceInt: 10000 }])
    );

    // Send NATS message
    const result = await firstValueFrom(
      client.send(EVENTS.ORDER.CREATE, {
        userId: 'user-123',
        items: [{ productId: 'p1', quantity: 2, priceInt: 10000 }],
      })
    );

    expect(result.id).toBeDefined();
    expect(result.totalInt).toBe(20000);
    expect(result.items).toHaveLength(1);

    // Verify in database
    const order = await prisma.order.findUnique({
      where: { id: result.id },
      include: { items: true },
    });
    expect(order).toBeDefined();
    expect(order.items).toHaveLength(1);
  });
});
```

---

## 10. Deployment & Configuration

### 10.1. Environment Variables

```bash
# Database
DATABASE_URL_ORDER=postgresql://postgres:postgres@localhost:5436/order_db

# NATS
NATS_URL=nats://localhost:4222

# Service
NODE_ENV=production
PORT=3004
```

### 10.2. Docker Configuration

```yaml
# docker-compose.yml
services:
  order-app:
    build:
      context: .
      dockerfile: apps/order-app/Dockerfile
    environment:
      DATABASE_URL_ORDER: postgresql://postgres:postgres@order-db:5432/order_db
      NATS_URL: nats://nats:4222
    depends_on:
      - order-db
      - nats
      - product-app # Required dependency
      - cart-app # Required dependency
    restart: unless-stopped

  order-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: order_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5436:5432'
    volumes:
      - order-db-data:/var/lib/postgresql/data

volumes:
  order-db-data:
```

### 10.3. Health Checks

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.$queryRaw`SELECT 1`, // Database health
      // Could add NATS health check
    ]);
  }
}
```

---

## 11. Kết Luận và Đánh Giá

### 11.1. Ưu Điểm Của Thiết Kế

✅ **Orchestration Pattern hiệu quả:**

- Order Service điều phối workflow giữa Product, Cart, Payment
- Centralized business logic dễ maintain

✅ **State Machine rõ ràng:**

- Order status transitions được validate chặt chẽ
- Terminal states (DELIVERED, CANCELLED) không thể thay đổi

✅ **Fire-and-Forget cho Non-Critical Ops:**

- Stock updates không block order creation
- Cart clearing không ảnh hưởng order flow
- Improved performance và resilience

✅ **Price Snapshot Pattern:**

- Order total không thay đổi khi product price thay đổi
- Historical accuracy cho accounting

✅ **Error Handling chi tiết:**

- Specific exceptions cho từng error scenario
- Clear error messages với context

### 11.2. Nhược Điểm và Trade-offs

❌ **No Distributed Transaction:**

- Stock decrement có thể fail mà order vẫn được tạo
- Cần manual reconciliation process

❌ **Eventual Consistency:**

- Stock không updated ngay lập tức
- Có thể oversell trong race conditions

❌ **Single Point of Failure:**

- Order Service là hub, nếu down thì entire checkout flow fail
- Product Service timeout block order creation

❌ **Cascading Failures:**

- Nếu Product Service chậm, Order Service cũng chậm
- Timeout errors propagate lên Gateway

❌ **No Compensation Logic:**

- Khi order cancelled, stock restore là fire-and-forget
- Nếu restore fail, cần manual intervention

### 11.3. Lessons Learned

**1. Fire-and-Forget cần monitoring:**

- Log errors rõ ràng cho manual intervention
- Implement metrics để track failure rates
- Consider dead letter queue cho failed messages

**2. Timeout values quan trọng:**

- 5s timeout cho Product Service có thể quá ngắn trong load cao
- Cần tuning based on performance metrics
- Consider exponential backoff

**3. Stock validation cần cẩn thận:**

- Race condition: 2 orders check stock cùng lúc → oversell
- Solution: Implement stock reservation system (future)

**4. Price snapshot là best practice:**

- Tránh disputes về giá
- Simplify accounting và refunds

### 11.4. Khuyến Nghị Cải Tiến

**Short-term (3-6 months):**

1. **Implement Stock Reservation:**

```typescript
// Thay vì validate rồi decrement
// → Reserve stock, then commit/release
async createOrder(dto) {
  const reservation = await this.reserveStock(dto.items);
  try {
    const order = await this.prisma.order.create({...});
    await this.commitStockReservation(reservation);
    return order;
  } catch (error) {
    await this.releaseStockReservation(reservation);
    throw error;
  }
}
```

2. **Add Idempotency Keys:**

```prisma
model Order {
  id              String  @id @default(cuid())
  idempotencyKey  String? @unique
  // ... other fields
}
```

3. **Implement Dead Letter Queue:**

```typescript
// Failed stock updates → DLQ → Manual review
private async decrementProductStock(items) {
  try {
    await this.productClient.send(...);
  } catch (error) {
    await this.deadLetterQueue.publish({
      type: 'STOCK_DECREMENT_FAILED',
      orderId: this.orderId,
      items,
      error: error.message,
    });
  }
}
```

**Medium-term (6-12 months):**

4. **Implement Saga Pattern:**

- Use event sourcing cho distributed transactions
- Automatic compensation logic
- Full audit trail

5. **Add Circuit Breaker:**

```typescript
// Prevent cascading failures
@CircuitBreaker({ threshold: 5, timeout: 60000 })
private async validateProductsAndStock(items) {
  // If Product Service fails 5 times, open circuit for 60s
}
```

6. **Implement Retry with Exponential Backoff:**

```typescript
.pipe(
  retry({
    count: 3,
    delay: (error, retryCount) => timer(Math.pow(2, retryCount) * 1000),
  }),
)
```

**Long-term (12+ months):**

7. **Event-Driven Architecture:**

```
OrderCreated → StockReserved → PaymentCompleted → StockCommitted → OrderProcessing
```

8. **CQRS Pattern:**

- Write model: Order creation với validations
- Read model: Optimized order queries với denormalized data

9. **Implement Distributed Tracing:**

- Jaeger/Zipkin để trace requests qua multiple services
- Identify bottlenecks và slow queries

### 11.5. Đóng Góp Cho Luận Văn

**Kiến thức thu được:**

- **Orchestration Pattern**: Service điều phối multiple services
- **State Machine**: Quản lý complex state transitions
- **Fire-and-Forget**: Trade-off giữa consistency và performance
- **Distributed Transactions**: Challenges và solutions (Saga pattern)
- **Eventual Consistency**: Accept inconsistency cho better availability

**Challenges đã vượt qua:**

- Thiết kế workflow phức tạp với multiple service calls
- Handle timeout và errors từ external services
- Balance giữa immediate consistency vs performance
- Implement state machine với validation logic

**Skills phát triển:**

- RxJS operators (timeout, catchError, retry)
- Microservices communication patterns
- Transaction management trong distributed systems
- Error handling strategies
- Testing với mocked external services

### 11.6. Metrics to Monitor

**Business Metrics:**

- Order creation rate (orders/minute)
- Order cancellation rate
- Average order value
- Time from PENDING to DELIVERED

**Technical Metrics:**

- Order creation latency (p50, p95, p99)
- Product Service call success rate
- Stock update failure rate
- Database query time
- NATS message throughput

**Alerts:**

- Product Service timeout > 10% in last 5 minutes
- Stock update failure > 5% in last hour
- Order creation failure > 1% in last minute
- Database connection pool exhausted

---

## Phụ Lục

### A. NATS Event Patterns

```typescript
// libs/shared/events.ts
export const EVENTS = {
  ORDER: {
    CREATE: 'order.create',
    GET: 'order.get',
    LIST: 'order.list',
    UPDATE_STATUS: 'order.updateStatus',
    UPDATE_PAYMENT_STATUS: 'order.updatePaymentStatus',
    CANCEL: 'order.cancel',
  },
  PRODUCT: {
    GET_BY_IDS: 'product.getByIds',
    DEC_STOCK: 'product.decrementStock',
    INC_STOCK: 'product.incrementStock',
  },
  CART: {
    CLEAR: 'cart.clear',
  },
};
```

### B. Database Indexes

```prisma
model Order {
  id         String  @id @default(cuid())
  userId     String
  status     OrderStatus
  createdAt  DateTime @default(now())

  @@index([userId])           // Query orders by user
  @@index([status])           // Filter by status
  @@index([userId, createdAt]) // Pagination by user
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  productId String

  @@index([orderId])    // Join with Order
  @@index([productId])  // Query items by product
}
```

### C. API Endpoints Overview

| Endpoint             | Method | Auth  | Description               |
| -------------------- | ------ | ----- | ------------------------- |
| `/orders`            | POST   | Yes   | Tạo order mới             |
| `/orders/:id`        | GET    | Yes   | Lấy chi tiết order        |
| `/orders`            | GET    | Yes   | Danh sách orders của user |
| `/orders/:id/status` | PATCH  | Admin | Cập nhật order status     |
| `/orders/:id/cancel` | POST   | Yes   | Hủy order                 |

### D. Troubleshooting Guide

**Issue 1: Order created but stock not decremented**

```
Symptom: Order exists in DB but product stock unchanged
Root Cause: Fire-and-forget stock update failed
Solution: Check logs for "Failed to decrement stock"
         Manually adjust stock in Product Service
         Consider implementing retry with DLQ
```

**Issue 2: Product Service timeout**

```
Symptom: Order creation fails with "Product service không phản hồi"
Root Cause: Product Service overloaded or down
Solution: Check Product Service health
         Increase timeout from 5s to 10s
         Implement circuit breaker
         Consider caching product data
```

**Issue 3: Duplicate orders**

```
Symptom: User creates 2 orders for same items
Root Cause: No idempotency key, user double-clicked
Solution: Implement idempotency key
         Check for duplicate orders in last 60s
         UI: Disable button after click
```

---

**Tài liệu này được tạo bởi Knowledge Capture Assistant**  
**Ngày tạo**: 31/10/2025  
**Phiên bản**: 1.0.0  
**Tác giả**: Hệ thống AI Assistant  
**Mục đích**: Luận văn tốt nghiệp - E-commerce Microservices Platform
