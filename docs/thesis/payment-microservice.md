# Tài Liệu Kỹ Thuật: Payment Microservice

> **Tài liệu luận văn tốt nghiệp** - Hệ thống E-commerce Microservices  
> **Service**: Payment App (`apps/payment-app`)  
> **Ngày phân tích**: 31/10/2025  
> **Phạm vi**: Microservice xử lý thanh toán, tích hợp payment gateway và webhook handling

---

## 📋 Mục Lục

1. [Tổng Quan Microservice](#1-tổng-quan-microservice)
2. [Kiến Trúc và Thiết Kế](#2-kiến-trúc-và-thiết-kế)
3. [Cơ Sở Dữ Liệu](#3-cơ-sở-dữ-liệu)
4. [Payment Methods](#4-payment-methods)
5. [Payment Workflows](#5-payment-workflows)
6. [SePay Integration](#6-sepay-integration)
7. [Webhook Handling](#7-webhook-handling)
8. [Security và Idempotency](#8-security-và-idempotency)
9. [Testing Strategy](#9-testing-strategy)
10. [Deployment & Configuration](#10-deployment--configuration)
11. [Kết Luận và Đánh Giá](#11-kết-luận-và-đánh-giá)

---

## 1. Tổng Quan Microservice

### 1.1. Mục Đích và Vai Trò

**Payment Microservice** là service critical xử lý tất cả các giao dịch thanh toán trong hệ thống e-commerce:

- **Payment Processing**: Xử lý thanh toán COD và online (SePay)
- **Payment Gateway Integration**: Tích hợp với SePay để nhận thanh toán chuyển khoản
- **Webhook Handling**: Nhận và xử lý webhook từ payment gateway
- **Transaction Tracking**: Lưu trữ lịch sử giao dịch đầy đủ
- **Payment Verification**: Xác thực thanh toán từ gateway callbacks
- **COD Confirmation**: Xác nhận đã thu tiền COD (admin/shipper)

### 1.2. Vị Trí Trong Kiến Trúc Microservices

```
┌─────────────┐
│   Gateway   │ ◄─── HTTP/REST from clients
└──────┬──────┘
       │ NATS
       ▼
┌─────────────────┐
│   NATS Broker   │
└────────┬────────┘
         │
    ┌────┴──────────────┐
    ▼                   ▼
┌──────────┐      ┌────────┐
│ PAYMENT  │◄────▶│ ORDER  │
│   App    │      │  App   │
└────┬─────┘      └────────┘
     │
     │ Webhook from SePay Gateway
     ▼
┌─────────────────┐
│  SePay Gateway  │ ◄─── Bank transfer notifications
└─────────────────┘
     │
     ▼
┌─────────────┐
│ PostgreSQL  │
│ payment_db  │
│             │
│ - Payment   │
│ - Transaction │
└─────────────┘
```

**Đặc điểm:**

- **Financial Critical**: Xử lý tiền bạc, cần accuracy và security cao
- **External Integration**: Giao tiếp với payment gateway bên ngoài
- **Webhook Receiver**: Nhận async callbacks từ gateway
- **Audit Trail**: Lưu trữ đầy đủ lịch sử giao dịch

### 1.3. Tech Stack

| Component           | Technology      | Version |
| ------------------- | --------------- | ------- |
| **Framework**       | NestJS          | v11.x   |
| **Runtime**         | Node.js         | v20+    |
| **Language**        | TypeScript      | v5.x    |
| **Message Broker**  | NATS            | v2.29   |
| **Database**        | PostgreSQL      | v16     |
| **ORM**             | Prisma          | v6.x    |
| **Payment Gateway** | SePay           | -       |
| **Validation**      | class-validator | -       |
| **Testing**         | Jest            | v30     |

### 1.4. Port Configuration

```
Service Port: 3005
Database Port: 5437
NATS URL: nats://localhost:4222
Queue Group: payment-app
SePay Webhook: /webhook/sepay (via Gateway)
```

---

## 2. Kiến Trúc và Thiết Kế

### 2.1. Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│              External Layer (SePay Gateway)              │
│                     Webhook Callbacks                    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP POST
┌────────────────────▼────────────────────────────────────┐
│                   Gateway Layer                          │
│              (Webhook endpoint → NATS)                   │
└────────────────────┬────────────────────────────────────┘
                     │ NATS
┌────────────────────▼────────────────────────────────────┐
│                 Controller Layer                         │
│              PaymentsController                          │
│  - process()      - verify()      - confirmCod()        │
│  - getById()      - getByOrder()  - sepayWebhook()     │
└────────────────────┬────────────────────────────────────┘
                     │ Delegates
┌────────────────────▼────────────────────────────────────┐
│                  Service Layer                           │
│              PaymentsService                             │
│  - Payment processing logic                              │
│  - SePay integration                                     │
│  - Webhook processing                                    │
│  - Transaction tracking                                  │
└────────────────────┬────────────────────────────────────┘
                     │ Database ops
┌────────────────────▼────────────────────────────────────┐
│               Data Access Layer                          │
│              (Prisma ORM Client)                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                PostgreSQL Database                       │
│    - Payment table (payment records)                     │
│    - Transaction table (SePay transaction history)       │
└─────────────────────────────────────────────────────────┘
```

### 2.2. Module Structure

```typescript
// apps/payment-app/src/payment-app.module.ts
@Module({
  imports: [PaymentsModule],
  providers: [PrismaService],
})
export class PaymentAppModule {}
```

**PaymentsModule Configuration:**

```typescript
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
          queue: 'order-app',
        },
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PrismaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

**Key Design Decisions:**

1. **Single External Dependency**: Chỉ gọi Order Service để update order status
2. **Webhook Processing**: Separate event handler cho SePay webhook
3. **Transaction Logging**: Tất cả transactions từ SePay đều được lưu

### 2.3. Bootstrap Configuration

```typescript
// apps/payment-app/src/main.ts
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(PaymentAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'payment-app',
    },
  });

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

  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
}
```

---

## 3. Cơ Sở Dữ Liệu

### 3.1. Database Schema Design

```prisma
// apps/payment-app/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_PAYMENT")
}

generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

// Payment Methods Enum
enum PaymentMethod {
  COD      // Cash on Delivery
  SEPAY    // Bank transfer via SePay gateway
}

// Payment Status Enum
enum PaymentStatus {
  UNPAID   // Payment not yet completed
  PAID     // Payment successful
}

// Payment Entity
model Payment {
  id        String        @id @default(cuid())
  orderId   String        // Logical FK to Order (in order-app)
  method    PaymentMethod
  amountInt Int           // Amount in cents (VND * 100)
  status    PaymentStatus @default(UNPAID)
  payload   Json?         // Additional data (gateway response, metadata)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
}

// Transaction Entity - Lưu raw data từ SePay webhook
model Transaction {
  id                 String   @id @default(cuid())
  sePayId            Int      @unique  // ID from SePay (idempotency key)
  gateway            String   // Bank name (VCB, TCB, MB, etc.)
  transactionDate    DateTime // When transaction occurred
  accountNumber      String   // Bank account number
  subAccount         String?  // Sub-account if applicable
  amountIn           Int      @default(0)  // Incoming amount
  amountOut          Int      @default(0)  // Outgoing amount
  accumulated        Int      @default(0)  // Accumulated balance
  code               String?  // Transaction code
  transactionContent String   // Transaction description (contains order ID)
  referenceCode      String   // Reference code from bank
  description        String   // Additional description
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([sePayId])
  @@index([transactionDate])
}
```

### 3.2. Database Design Principles

#### 3.2.1. Payment Record vs Transaction Record

**Critical Distinction:**

```
Payment Table:
- Business-level record
- Represents "intention to pay"
- Created when user selects payment method
- Status: UNPAID → PAID
- Links to Order

Transaction Table:
- Technical-level record
- Raw data from SePay webhook
- Created when bank transaction happens
- Audit trail / reconciliation
- NOT directly linked to Payment (matched by orderId in content)
```

**Lý do:**

- ✅ **Separation of Concerns**: Business logic vs audit trail
- ✅ **Reconciliation**: Có thể có transactions không match với payments
- ✅ **Idempotency**: Transaction.sePayId đảm bảo không duplicate
- ✅ **Audit Trail**: Full history của tất cả bank transactions

#### 3.2.2. Amount Storage (Cents Pattern)

**Tại sao lưu `amountInt` (cents) thay vì `amount` (float)?**

```typescript
// ❌ WRONG - Float precision issues
amount: 10.5; // Could become 10.499999999

// ✅ CORRECT - Store as cents (integer)
amountInt: 1050; // 10.50 VND = 1050 cents
```

**Benefits:**

- ✅ **No Float Precision Errors**: Integer arithmetic chính xác 100%
- ✅ **Database Compatibility**: All databases handle integers well
- ✅ **No Rounding Issues**: Critical cho financial calculations

#### 3.2.3. JSON Payload Field

```typescript
// Payment.payload stores flexible data:
{
  // For COD
  confirmedAt: "2025-10-31T10:30:00Z",
  method: "manual_cod_confirmation"
}

{
  // For SePay
  sePayTransactionId: 12345,
  gateway: "VCB",
  referenceCode: "FT123456",
  transactionDate: "2025-10-31T10:30:00Z"
}
```

**Lợi ích:**

- ✅ **Flexibility**: Mỗi payment method có data khác nhau
- ✅ **Future-proof**: Dễ thêm fields mới không cần migrate
- ✅ **Gateway Integration**: Lưu raw response từ gateway

### 3.3. Entity Relationships

```mermaid
erDiagram
    Payment ||--o| Order : "references (logical)"
    Transaction }o..o| Payment : "matched by orderId"

    Payment {
        string id PK
        string orderId FK_LOGICAL
        PaymentMethod method
        int amountInt
        PaymentStatus status
        json payload
        datetime createdAt
        datetime updatedAt
    }

    Transaction {
        string id PK
        int sePayId UK "Idempotency key"
        string gateway
        datetime transactionDate
        string accountNumber
        int amountIn
        int amountOut
        string transactionContent "Contains orderId"
        string referenceCode
        datetime createdAt
    }

    Order {
        string id PK
        PaymentStatus paymentStatus
    }
```

### 3.4. Database Query Patterns

#### 3.4.1. Idempotent Transaction Insert

```typescript
// Check duplicate before insert
const existingTransaction = await this.prisma.transaction.findUnique({
  where: { sePayId: dto.id },
});

if (existingTransaction) {
  console.log(`Duplicate webhook ignored: sePayId=${dto.id}`);
  return { success: true, message: 'Already processed' };
}

// Create new transaction
await this.prisma.transaction.create({
  data: {
    sePayId: dto.id,
    gateway: dto.gateway,
    transactionDate: new Date(dto.transactionDate),
    amountIn: dto.transferType === 'in' ? dto.transferAmount : 0,
    ...
  },
});
```

#### 3.4.2. Find Payment by Order

```typescript
// Get latest payment for order (multiple payments possible if retry)
const payment = await this.prisma.payment.findFirst({
  where: { orderId: dto.orderId },
  orderBy: { createdAt: 'desc' }, // Latest first
});
```

#### 3.4.3. Match Transaction to Payment

```typescript
// Match by: orderId (from content), amount, status UNPAID
const payment = await this.prisma.payment.findFirst({
  where: {
    orderId: extractedOrderId,
    amountInt: transaction.amountIn,
    status: 'UNPAID',
  },
});
```

---

## 4. Payment Methods

### 4.1. Supported Payment Methods

```typescript
enum PaymentMethod {
  COD, // Cash on Delivery
  SEPAY, // Bank Transfer via SePay
}
```

### 4.2. COD (Cash on Delivery)

**Workflow:**

```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant Payment
    participant Order

    User->>Gateway: Select COD payment
    Gateway->>Payment: payment.process {method: COD}
    Payment->>Payment: Create Payment (UNPAID)
    Payment->>Order: Update status to PROCESSING
    Payment-->>Gateway: Payment created (UNPAID)
    Gateway-->>User: Order confirmed, pay on delivery

    Note over User: Days later...

    User->>User: Receive order, pay cash
    Note over Gateway: Shipper/Admin confirms
    Gateway->>Payment: payment.confirmCod
    Payment->>Payment: Update Payment to PAID
    Payment->>Order: Update paymentStatus to PAID
    Payment-->>Gateway: COD confirmed
```

**Characteristics:**

- ✅ **Instant Order Creation**: Không cần chờ payment gateway
- ✅ **Low Friction**: User không cần credit card/bank account
- ✅ **Manual Confirmation**: Admin/shipper confirm sau khi thu tiền
- ❌ **Cash Flow Delay**: Tiền về sau khi giao hàng
- ❌ **Higher Risk**: User có thể từ chối nhận hàng

**Implementation:**

```typescript
if (dto.method === PaymentMethod.COD) {
  // Create payment record
  const payment = await this.prisma.payment.create({
    data: {
      orderId: dto.orderId,
      method: PaymentMethod.COD,
      amountInt: dto.amountInt,
      status: PaymentStatus.UNPAID,
    },
  });

  // Update order to PROCESSING (not waiting for payment)
  await this.updateOrderStatus(dto.orderId, OrderStatus.PROCESSING);

  return {
    paymentId: payment.id,
    status: PaymentStatus.UNPAID,
    message: 'COD payment created - will be completed on delivery',
  };
}
```

### 4.3. SePay (Bank Transfer)

**Workflow:**

```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant Payment
    participant SePay
    participant Bank
    participant Order

    User->>Gateway: Select Bank Transfer
    Gateway->>Payment: payment.process {method: SEPAY}
    Payment->>Payment: Create Payment (UNPAID)
    Payment->>Payment: Generate SePay QR URL
    Payment-->>Gateway: QR code URL
    Gateway-->>User: Show QR code

    User->>Bank: Scan QR, transfer money
    Bank->>SePay: Transaction notification
    SePay->>Gateway: POST /webhook/sepay
    Gateway->>Payment: payment.webhook.sepay

    Payment->>Payment: Save Transaction
    Payment->>Payment: Extract orderId from content
    Payment->>Payment: Find matching Payment
    Payment->>Payment: Update Payment to PAID
    Payment->>Order: Update paymentStatus to PAID
    Payment-->>Gateway: Webhook processed
```

**Characteristics:**

- ✅ **Real-time Notification**: Webhook trong vài giây sau khi transfer
- ✅ **Automatic Matching**: Extract orderId từ transaction content
- ✅ **Low Fees**: SePay có phí thấp hơn credit card
- ✅ **Popular in Vietnam**: Bank transfer rất phổ biến
- ❌ **User Friction**: Phải switch app để transfer
- ❌ **Webhook Dependency**: Nếu webhook fail, cần manual reconciliation

**SePay QR URL Format:**

```
https://qr.sepay.vn/img?acc={ACCOUNT_NO}&bank={BANK_NAME}&amount={AMOUNT}&des={DESCRIPTION}

Example:
https://qr.sepay.vn/img?acc=1234567890&bank=Vietcombank&amount=100000&des=DH123
```

**Implementation:**

```typescript
// Generate QR URL
const qrCodeUrl = this.generateSePayQRUrl(
  process.env.SEPAY_ACCOUNT_NUMBER!, // e.g., "1234567890"
  process.env.SEPAY_BANK_NAME!, // e.g., "Vietcombank"
  dto.amountInt, // e.g., 100000
  dto.orderId, // e.g., "order-123"
);

return {
  paymentId: payment.id,
  status: PaymentStatus.UNPAID,
  paymentUrl: qrCodeUrl,
  qrCode: qrCodeUrl,
  message: 'SePay payment created',
};
```

---

## 5. Payment Workflows

### 5.1. Create Payment Flow

**End-to-End Sequence:**

```mermaid
sequenceDiagram
    participant Gateway
    participant Payment
    participant Order
    participant DB

    Gateway->>Payment: payment.process {orderId, method, amountInt}

    Note over Payment: Step 1: Validate order
    Payment->>Order: order.get {id: orderId}
    Order-->>Payment: Order (status: PENDING)

    alt Order not PENDING
        Payment-->>Gateway: ValidationException
    end

    Note over Payment: Step 2: Create payment record
    Payment->>DB: INSERT INTO Payment
    DB-->>Payment: Payment created (UNPAID)

    alt Method = COD
        Note over Payment: Step 3a: COD flow
        Payment->>Order: order.updateStatus {PROCESSING}
        Payment-->>Gateway: {paymentId, status: UNPAID}
    else Method = SEPAY
        Note over Payment: Step 3b: SePay flow
        Payment->>Payment: Generate QR URL
        Payment-->>Gateway: {paymentId, qrCode, status: UNPAID}
    end
```

**Implementation:**

```typescript
async process(dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
  // Step 1: Validate order
  await this.validateOrderForPayment(dto.orderId);

  // Step 2: Create payment record
  const payment = await this.prisma.payment.create({
    data: {
      orderId: dto.orderId,
      method: dto.method,
      amountInt: dto.amountInt,
      status: PaymentStatus.UNPAID,
    },
  });

  // Step 3: Handle by method
  if (dto.method === PaymentMethod.COD) {
    await this.updateOrderStatus(dto.orderId, OrderStatus.PROCESSING);
    return {
      paymentId: payment.id,
      status: PaymentStatus.UNPAID,
      message: 'COD payment created',
    };
  }

  // SePay: Generate QR URL
  const qrCodeUrl = this.generateSePayQRUrl(
    process.env.SEPAY_ACCOUNT_NUMBER!,
    process.env.SEPAY_BANK_NAME!,
    dto.amountInt,
    dto.orderId,
  );

  return {
    paymentId: payment.id,
    status: PaymentStatus.UNPAID,
    paymentUrl: qrCodeUrl,
    qrCode: qrCodeUrl,
  };
}
```

### 5.2. Order Validation

**Business Rules:**

- Order phải tồn tại
- Order phải ở trạng thái PENDING (chưa thanh toán)
- Order Service timeout = 5s

```typescript
private async validateOrderForPayment(orderId: string): Promise<void> {
  try {
    const order = await firstValueFrom(
      this.orderClient.send(EVENTS.ORDER.GET, { id: orderId }).pipe(
        timeout(5000),
        catchError(error => {
          if (error.name === 'TimeoutError') {
            return throwError(
              () => new ValidationRpcException('Order service không phản hồi')
            );
          }
          return throwError(
            () => new EntityNotFoundRpcException('Order', orderId)
          );
        }),
      ),
    );

    if (order.status !== OrderStatus.PENDING) {
      throw new ValidationRpcException(
        `Cannot process payment for order with status: ${order.status}`
      );
    }
  } catch (error) {
    // Re-throw known errors
    if (error instanceof EntityNotFoundRpcException ||
        error instanceof ValidationRpcException) {
      throw error;
    }
    throw new ValidationRpcException('Failed to validate order');
  }
}
```

### 5.3. COD Confirmation Flow

**Sequence:**

```mermaid
sequenceDiagram
    participant Admin/Shipper
    participant Gateway
    participant Payment
    participant Order

    Admin/Shipper->>Gateway: Confirm COD {paymentId or orderId}
    Gateway->>Payment: payment.confirmCod

    Payment->>Payment: Find payment

    alt Payment not found
        Payment-->>Gateway: EntityNotFoundException
    end

    alt Payment not COD
        Payment-->>Gateway: ValidationException
    end

    alt Payment already PAID
        Payment-->>Gateway: ValidationException
    end

    Payment->>Payment: Update Payment to PAID
    Payment->>Payment: Add confirmation metadata
    Payment->>Order: order.updatePaymentStatus {PAID}
    Payment-->>Gateway: Payment confirmed
```

**Implementation:**

```typescript
async confirmCodPayment(
  dto: PaymentIdDto | PaymentByOrderDto
): Promise<PaymentResponse> {
  // Find payment
  let payment = null;
  if ('id' in dto) {
    payment = await this.prisma.payment.findUnique({ where: { id: dto.id } });
  } else {
    payment = await this.prisma.payment.findFirst({
      where: { orderId: dto.orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!payment) {
    throw new EntityNotFoundRpcException('Payment', dto.id || dto.orderId);
  }

  // Validate COD
  if (payment.method !== PaymentMethod.COD) {
    throw new ValidationRpcException(
      `Cannot confirm non-COD payment. Method: ${payment.method}`
    );
  }

  // Validate not already paid
  if (payment.status === PaymentStatus.PAID) {
    throw new ValidationRpcException('Payment already confirmed');
  }

  // Update payment
  const updatedPayment = await this.prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PAID,
      payload: {
        confirmedAt: new Date().toISOString(),
        method: 'manual_cod_confirmation',
      },
    },
  });

  // Update order (fire-and-forget)
  this.updateOrderPaymentStatus(payment.orderId, PaymentStatus.PAID);

  return updatedPayment;
}
```

---

## 6. SePay Integration

### 6.1. SePay Overview

**SePay** là payment gateway phổ biến tại Việt Nam, cho phép:

- Tạo QR code cho bank transfer
- Nhận webhook realtime khi có giao dịch
- Hỗ trợ tất cả ngân hàng lớn (VCB, TCB, MB, ACB, etc.)

**SePay QR Code Format:**

```
https://qr.sepay.vn/img?acc={ACCOUNT_NO}&bank={BANK_NAME}&amount={AMOUNT}&des={DESCRIPTION}
```

**Parameters:**

- `acc`: Số tài khoản ngân hàng merchant
- `bank`: Tên ngân hàng (chuẩn SePay: "Vietcombank", "MBBank", etc.)
- `amount`: Số tiền (VND, integer)
- `des`: Nội dung chuyển khoản (chứa order ID để matching)

### 6.2. QR Code Generation

**Implementation:**

```typescript
private generateSePayQRUrl(
  accountNo: string,
  bankName: string,
  amount: number,
  orderId: string,
): string {
  // Format: DH{orderId} để dễ extract
  const description = `DH${orderId}`;

  return `https://qr.sepay.vn/img?acc=${accountNo}&bank=${encodeURIComponent(bankName)}&amount=${amount}&des=${encodeURIComponent(description)}`;
}
```

**Example:**

```typescript
generateSePayQRUrl('1234567890', 'Vietcombank', 100000, 'order-123');
// → https://qr.sepay.vn/img?acc=1234567890&bank=Vietcombank&amount=100000&des=DH-order-123
```

**User Experience:**

1. User nhận QR code
2. Mở banking app (Vietcombank, MB Bank, etc.)
3. Scan QR code
4. Confirm transfer (amount và content đã điền sẵn)
5. Webhook → Payment Service → Order updated

### 6.3. SePay Webhook Structure

**Webhook Payload từ SePay:**

```typescript
interface SePayWebhookDto {
  id: number; // SePay transaction ID (unique)
  gateway: string; // Bank code (e.g., "VCB", "MB")
  transactionDate: string; // ISO datetime
  accountNumber: string; // Merchant account number
  subAccount: string | null; // Sub-account if any
  transferType: 'in' | 'out'; // in = incoming, out = outgoing
  transferAmount: number; // Amount transferred
  accumulated: number; // Account balance after transaction
  code: string | null; // Transaction code
  content: string; // Transaction content (contains orderId)
  referenceCode: string; // Bank reference code
  description: string; // Additional description
}
```

**Example Webhook:**

```json
{
  "id": 12345,
  "gateway": "VCB",
  "transactionDate": "2025-10-31T10:30:00Z",
  "accountNumber": "1234567890",
  "subAccount": null,
  "transferType": "in",
  "transferAmount": 100000,
  "accumulated": 5000000,
  "code": "FT123456",
  "content": "DH-order-123 Thanh toan don hang",
  "referenceCode": "FT2025103112345",
  "description": "Transfer from customer"
}
```

---

## 7. Webhook Handling

### 7.1. Webhook Processing Flow

**Complete Sequence:**

```mermaid
sequenceDiagram
    participant SePay
    participant Gateway
    participant Payment
    participant Order
    participant DB

    SePay->>Gateway: POST /webhook/sepay
    Gateway->>Payment: payment.webhook.sepay

    Note over Payment: Step 1: Check idempotency
    Payment->>DB: SELECT Transaction WHERE sePayId={id}

    alt Transaction exists
        Payment-->>Gateway: {success: true, "Already processed"}
        Gateway-->>SePay: 200 OK
    end

    Note over Payment: Step 2: Save transaction
    Payment->>DB: INSERT INTO Transaction

    alt transferType = 'out'
        Payment-->>Gateway: {success: true, "Not incoming"}
        Gateway-->>SePay: 200 OK
    end

    Note over Payment: Step 3: Extract orderId
    Payment->>Payment: Regex extract "DH123" from content

    alt No orderId found
        Payment-->>Gateway: {success: true, "No orderId"}
        Gateway-->>SePay: 200 OK
    end

    Note over Payment: Step 4: Find matching payment
    Payment->>DB: SELECT Payment WHERE orderId AND amount AND UNPAID

    alt No payment found
        Payment-->>Gateway: {success: true, "No matching payment"}
        Gateway-->>SePay: 200 OK
    end

    Note over Payment: Step 5: Update payment
    Payment->>DB: UPDATE Payment SET status=PAID

    Note over Payment: Step 6: Update order
    Payment->>Order: order.updatePaymentStatus {PAID}

    Note over Payment: Step 7: Notify frontend
    Payment->>Payment: notifyFrontend() [fire-and-forget]

    Payment-->>Gateway: {success: true, orderId, paymentId}
    Gateway-->>SePay: 200 OK
```

### 7.2. Webhook Implementation

**Full Code:**

```typescript
async handleSePayWebhook(dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
  try {
    // Step 1: Idempotency check
    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { sePayId: dto.id },
    });

    if (existingTransaction) {
      console.log(`Duplicate webhook ignored: sePayId=${dto.id}`);
      return {
        success: true,
        message: 'Transaction already processed (duplicate webhook)',
      };
    }

    // Step 2: Save transaction
    const transactionDate = new Date(dto.transactionDate);
    const amountIn = dto.transferType === 'in' ? dto.transferAmount : 0;
    const amountOut = dto.transferType === 'out' ? dto.transferAmount : 0;

    await this.prisma.transaction.create({
      data: {
        sePayId: dto.id,
        gateway: dto.gateway,
        transactionDate,
        accountNumber: dto.accountNumber,
        subAccount: dto.subAccount,
        amountIn,
        amountOut,
        accumulated: dto.accumulated,
        code: dto.code,
        transactionContent: dto.content,
        referenceCode: dto.referenceCode,
        description: dto.description,
      },
    });

    // Step 3: Check if incoming transaction
    if (dto.transferType !== 'in') {
      return {
        success: true,
        message: 'Transaction saved (not an incoming payment)',
      };
    }

    // Step 4: Extract orderId from content
    const orderIdMatch = /DH[-_]?(\d+)/i.exec(dto.content);
    if (!orderIdMatch) {
      return {
        success: true,
        message: 'Transaction saved (no order ID in content)',
      };
    }

    const orderId = orderIdMatch[1];

    // Step 5: Find matching payment
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        amountInt: dto.transferAmount,
        status: 'UNPAID',
      },
    });

    if (!payment) {
      console.log(`No matching payment: orderId=${orderId}, amount=${dto.transferAmount}`);
      return {
        success: true,
        message: 'Transaction saved (no matching unpaid payment)',
      };
    }

    // Step 6: Update payment to PAID
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        payload: {
          sePayTransactionId: dto.id,
          gateway: dto.gateway,
          referenceCode: dto.referenceCode,
          transactionDate: dto.transactionDate,
        },
      },
    });

    // Step 7: Update order (fire-and-forget)
    this.updateOrderPaymentStatus(orderId, PaymentStatus.PAID);

    // Step 8: Notify frontend (fire-and-forget)
    this.notifyFrontend(orderId, payment.id, PaymentStatus.PAID);

    console.log(`Payment completed: orderId=${orderId}, paymentId=${payment.id}`);

    return {
      success: true,
      message: 'Payment processed successfully',
      orderId,
      paymentId: payment.id,
    };
  } catch (error) {
    console.error('[PaymentsService] handleSePayWebhook error:', error);

    // CRITICAL: Return success to SePay to avoid retry
    // We logged the error for manual investigation
    return {
      success: false,
      message: 'Internal error processing webhook',
    };
  }
}
```

### 7.3. Order ID Extraction

**Regex Pattern:**

```typescript
// Pattern: DH123, DH-123, DH_123, dh123 (case insensitive)
const orderIdMatch = /DH[-_]?(\d+)/i.exec(dto.content);

// Examples:
"DH123 Thanh toan don hang"     → orderId = "123"
"Thanh toan DH-456"              → orderId = "456"
"Don hang DH_789"                → orderId = "789"
"DHXYZ"                          → null (no match)
```

**Why this pattern?**

- ✅ **Simple và readable**: "DH" = "Đơn Hàng"
- ✅ **Unique**: Unlikely to appear in normal text
- ✅ **Flexible**: Support hyphen, underscore, or none
- ✅ **Case insensitive**: "DH123" or "dh123" both work

### 7.4. Payment Matching Logic

**Matching Criteria:**

```typescript
const payment = await this.prisma.payment.findFirst({
  where: {
    orderId: extractedOrderId, // Must match
    amountInt: dto.transferAmount, // Must match exactly
    status: 'UNPAID', // Only match unpaid
  },
});
```

**Why strict matching?**

- ✅ **Prevent Wrong Match**: Đảm bảo transaction đúng order
- ✅ **Prevent Double Credit**: Chỉ match với UNPAID payments
- ✅ **Amount Verification**: Customer không thể underpay

**Edge Cases:**

1. **Multiple payments for same order**: Match latest UNPAID
2. **Amount mismatch**: Transaction saved but no payment update
3. **No orderId in content**: Transaction saved for manual review
4. **Outgoing transaction**: Ignored (only process incoming)

---

## 8. Security và Idempotency

### 8.1. Idempotency Guarantee

**Problem: Duplicate Webhooks**

```
SePay → Gateway → Payment Service (✓ Processed)
                           ↓ (network error, no response)
SePay → Gateway → Payment Service (DUPLICATE!)
```

**Solution: sePayId Unique Constraint**

```prisma
model Transaction {
  sePayId Int @unique  // Database enforces uniqueness
}
```

**Implementation:**

```typescript
// Check BEFORE processing
const existingTransaction = await this.prisma.transaction.findUnique({
  where: { sePayId: dto.id },
});

if (existingTransaction) {
  // Return success immediately (idempotent response)
  return {
    success: true,
    message: 'Transaction already processed',
  };
}

// Process transaction...
```

**Benefits:**

- ✅ **No Double Processing**: Transaction chỉ xử lý 1 lần
- ✅ **Fast Check**: Unique index lookup rất nhanh
- ✅ **Database Guarantee**: Even if multiple instances race, DB ensures uniqueness

### 8.2. Amount Verification

**Critical Check:**

```typescript
const payment = await this.prisma.payment.findFirst({
  where: {
    orderId: orderId,
    amountInt: dto.transferAmount, // MUST match exactly
    status: 'UNPAID',
  },
});
```

**Scenarios:**

| Expected | Received | Action                                        |
| -------- | -------- | --------------------------------------------- |
| 100,000  | 100,000  | ✅ Match → Update payment                     |
| 100,000  | 50,000   | ❌ No match → Save transaction, manual review |
| 100,000  | 150,000  | ❌ No match → Save transaction, manual review |

**Tại sao không auto-accept partial/overpayment?**

- ❌ **Partial**: Customer chưa pay đủ
- ❌ **Over**: Có thể là typo, cần refund

### 8.3. Webhook Response Strategy

**CRITICAL: Always return 200 OK**

```typescript
try {
  // Process webhook...
  return { success: true, message: '...' };
} catch (error) {
  console.error('[PaymentsService] Webhook error:', error);

  // ⚠️ STILL return success to SePay
  // We logged error for manual intervention
  return {
    success: false,
    message: 'Internal error processing webhook',
  };
}
```

**Lý do:**

- ✅ **Prevent Retry Storm**: Nếu return error, SePay sẽ retry nhiều lần
- ✅ **Idempotency Friendly**: Duplicate webhooks return success
- ✅ **Manual Review**: Errors được log để manual fix

### 8.4. Transaction Audit Trail

**Full History:**

```typescript
// ALL transactions from SePay are saved
await this.prisma.transaction.create({
  data: {
    sePayId: dto.id,
    gateway: dto.gateway,
    transactionDate: transactionDate,
    accountNumber: dto.accountNumber,
    amountIn: dto.transferType === 'in' ? dto.transferAmount : 0,
    amountOut: dto.transferType === 'out' ? dto.transferAmount : 0,
    transactionContent: dto.content,
    referenceCode: dto.referenceCode,
    // ... all fields
  },
});
```

**Benefits:**

- ✅ **Reconciliation**: Compare với bank statements
- ✅ **Dispute Resolution**: Full history nếu có tranh chấp
- ✅ **Audit Compliance**: Required cho financial reporting
- ✅ **Manual Review**: Transactions không match được flag

### 8.5. Payment Gateway Verification (Mock)

**Current Implementation:**

```typescript
private mockVerifyPaymentGateway(payload: Record<string, unknown>): boolean {
  // Mock verification logic
  return payload.status === 'success' || payload.verified === true;
}
```

**Production Implementation:**

```typescript
private async verifyPaymentGateway(payload: Record<string, unknown>): Promise<boolean> {
  // 1. Verify signature
  const signature = this.calculateSignature(payload, SECRET_KEY);
  if (signature !== payload.signature) {
    return false;
  }

  // 2. Call gateway API to verify transaction
  const response = await fetch(`${GATEWAY_API}/verify`, {
    method: 'POST',
    body: JSON.stringify({ transactionId: payload.transactionId }),
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });

  const result = await response.json();
  return result.status === 'success';
}
```

---

## 9. Testing Strategy

### 9.1. Unit Testing

**Mock External Dependencies:**

```typescript
describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let orderClient: ClientProxy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: 'ORDER_SERVICE',
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
    prisma = module.get(PrismaService);
    orderClient = module.get('ORDER_SERVICE');
  });

  describe('process', () => {
    it('should create COD payment', async () => {
      // Mock order validation
      jest.spyOn(orderClient, 'send').mockReturnValue(of({ id: 'order-123', status: 'PENDING' }));

      // Mock payment creation
      const mockPayment = {
        id: 'payment-123',
        orderId: 'order-123',
        method: 'COD',
        status: 'UNPAID',
      };
      jest.spyOn(prisma.payment, 'create').mockResolvedValue(mockPayment);

      const result = await service.process({
        orderId: 'order-123',
        method: PaymentMethod.COD,
        amountInt: 100000,
      });

      expect(result.paymentId).toBe('payment-123');
      expect(result.status).toBe('UNPAID');
    });

    it('should generate SePay QR URL', async () => {
      jest.spyOn(orderClient, 'send').mockReturnValue(of({ id: 'order-123', status: 'PENDING' }));

      const mockPayment = {
        id: 'payment-123',
        method: 'SEPAY',
      };
      jest.spyOn(prisma.payment, 'create').mockResolvedValue(mockPayment);

      const result = await service.process({
        orderId: 'order-123',
        method: PaymentMethod.SEPAY,
        amountInt: 100000,
      });

      expect(result.qrCode).toContain('qr.sepay.vn');
      expect(result.qrCode).toContain('amount=100000');
    });
  });

  describe('handleSePayWebhook', () => {
    it('should ignore duplicate webhook', async () => {
      // Mock existing transaction
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
        id: 'tx-123',
        sePayId: 12345,
      });

      const result = await service.handleSePayWebhook({
        id: 12345,
        transferType: 'in',
        content: 'DH123',
        // ... other fields
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('already processed');
    });

    it('should extract orderId from content', async () => {
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.transaction, 'create').mockResolvedValue({});
      jest.spyOn(prisma.payment, 'findFirst').mockResolvedValue({
        id: 'payment-123',
        orderId: '123',
        amountInt: 100000,
        status: 'UNPAID',
      });
      jest.spyOn(prisma.payment, 'update').mockResolvedValue({});

      const result = await service.handleSePayWebhook({
        id: 12345,
        transferType: 'in',
        transferAmount: 100000,
        content: 'Thanh toan DH-123',
        // ... other fields
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('123');
    });
  });
});
```

### 9.2. E2E Testing

**Webhook Simulation:**

```typescript
describe('PaymentsController (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let prisma: PrismaService;

  it('should process SePay webhook', async () => {
    // Create payment first
    await prisma.payment.create({
      data: {
        id: 'payment-123',
        orderId: 'order-123',
        method: 'SEPAY',
        amountInt: 100000,
        status: 'UNPAID',
      },
    });

    // Simulate webhook
    const webhookDto: SePayWebhookDto = {
      id: 12345,
      gateway: 'VCB',
      transactionDate: new Date().toISOString(),
      accountNumber: '1234567890',
      transferType: 'in',
      transferAmount: 100000,
      content: 'DH-order-123 Thanh toan',
      referenceCode: 'FT123',
      // ... other fields
    };

    const result = await firstValueFrom(client.send(EVENTS.PAYMENT.WEBHOOK_SEPAY, webhookDto));

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('order-123');

    // Verify payment updated
    const payment = await prisma.payment.findUnique({
      where: { id: 'payment-123' },
    });
    expect(payment.status).toBe('PAID');

    // Verify transaction saved
    const transaction = await prisma.transaction.findUnique({
      where: { sePayId: 12345 },
    });
    expect(transaction).toBeDefined();
  });
});
```

---

## 10. Deployment & Configuration

### 10.1. Environment Variables

```bash
# Database
DATABASE_URL_PAYMENT=postgresql://postgres:postgres@localhost:5437/payment_db

# NATS
NATS_URL=nats://localhost:4222

# SePay Configuration
SEPAY_ACCOUNT_NUMBER=1234567890
SEPAY_BANK_NAME=Vietcombank

# Frontend Webhook
FRONTEND_WEBHOOK_URL=https://yourfrontend.com/webhook/payment

# Service
NODE_ENV=production
PORT=3005
```

### 10.2. Docker Configuration

```yaml
# docker-compose.yml
services:
  payment-app:
    build:
      context: .
      dockerfile: apps/payment-app/Dockerfile
    environment:
      DATABASE_URL_PAYMENT: postgresql://postgres:postgres@payment-db:5432/payment_db
      NATS_URL: nats://nats:4222
      SEPAY_ACCOUNT_NUMBER: ${SEPAY_ACCOUNT_NUMBER}
      SEPAY_BANK_NAME: ${SEPAY_BANK_NAME}
      FRONTEND_WEBHOOK_URL: ${FRONTEND_WEBHOOK_URL}
    depends_on:
      - payment-db
      - nats
      - order-app # Required for order updates
    restart: unless-stopped

  payment-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: payment_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5437:5432'
    volumes:
      - payment-db-data:/var/lib/postgresql/data

volumes:
  payment-db-data:
```

---

## 11. Kết Luận và Đánh Giá

### 11.1. Ưu Điểm Của Thiết Kế

✅ **Idempotency hoàn hảo:**

- Webhook có thể gọi nhiều lần không gây duplicate
- Database unique constraint đảm bảo consistency

✅ **Separation of Concerns:**

- Payment table: Business-level records
- Transaction table: Audit trail từ SePay

✅ **Flexible Payment Methods:**

- COD: Instant order creation
- SePay: Automatic webhook processing

✅ **Robust Error Handling:**

- Webhook luôn return 200 OK
- Errors được log cho manual review

✅ **Fire-and-Forget Updates:**

- Order updates không block payment processing
- Improved resilience

### 11.2. Nhược Điểm và Trade-offs

❌ **No Distributed Transaction:**

- Payment updated nhưng order update có thể fail
- Cần reconciliation process

❌ **Manual Reconciliation Required:**

- Transactions không match payment cần review
- Amount mismatch cần manual handling

❌ **Single Payment Gateway:**

- Chỉ hỗ trợ SePay
- Vendor lock-in risk

❌ **No Refund Support:**

- Chưa implement refund flow
- Critical cho customer service

❌ **Mock Verification:**

- Chưa implement real gateway signature verification
- Security risk

### 11.3. Khuyến Nghị Cải Tiến

**Short-term (3-6 months):**

1. **Implement Real Gateway Verification:**

```typescript
private async verifySePaySignature(dto: SePayWebhookDto): Promise<boolean> {
  const payload = {
    id: dto.id,
    amount: dto.transferAmount,
    // ... other fields
  };
  const signature = crypto
    .createHmac('sha256', SEPAY_SECRET_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === dto.signature;
}
```

2. **Add Reconciliation Dashboard:**

- List unmatched transactions
- Manual match interface
- Refund request workflow

3. **Implement Refund Flow:**

```typescript
async refund(dto: RefundDto): Promise<RefundResponse> {
  // 1. Find payment
  // 2. Validate refundable
  // 3. Create refund record
  // 4. Call SePay refund API
  // 5. Update order status
}
```

**Medium-term (6-12 months):**

4. **Multi-Gateway Support:**

- Abstract gateway interface
- Factory pattern cho gateway selection
- Support: VNPay, Momo, ZaloPay

5. **Payment Retry Logic:**

```typescript
// Automatic retry failed payments
await this.retryFailedPayment(paymentId, {
  maxRetries: 3,
  backoff: 'exponential',
});
```

6. **Webhook Queue:**

- Use message queue (RabbitMQ/Redis) cho webhooks
- Prevent loss nếu service down
- Enable rate limiting

**Long-term (12+ months):**

7. **Event Sourcing:**

- Track all payment state changes
- Complete audit trail
- Enable replay và debugging

8. **Fraud Detection:**

- Monitor suspicious patterns
- Multiple failed payments → flag
- Unusual amounts → alert

9. **Real-time Notifications:**

- WebSocket to frontend khi payment complete
- Push notifications to mobile app
- Email receipts

### 11.4. Đóng Góp Cho Luận Văn

**Kiến thức thu được:**

- **Payment Gateway Integration**: Thực tế tích hợp SePay
- **Webhook Handling**: Idempotency, error handling
- **Financial Data**: Amount storage, audit trail
- **Async Processing**: Fire-and-forget patterns
- **Security**: Signature verification, amount matching

**Challenges đã vượt qua:**

- Thiết kế idempotent webhook processing
- Extract orderId từ unstructured text
- Handle webhook retries gracefully
- Balance immediate response vs eventual consistency

---

**Tài liệu này được tạo bởi Knowledge Capture Assistant**  
**Ngày tạo**: 31/10/2025  
**Phiên bản**: 1.0.0  
**Tác giả**: Hệ thống AI Assistant  
**Mục đích**: Luận văn tốt nghiệp - E-commerce Microservices Platform
