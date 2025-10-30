# Knowledge Base: Payment App Microservice

## Metadata

- **Analysis Date**: 2025-10-30
- **Entry Point**: `/apps/payment-app`
- **Depth**: Full service analysis (Controllers, Services, Database, Integration)
- **Files Analyzed**:
  - `apps/payment-app/src/main.ts`
  - `apps/payment-app/src/payment-app.module.ts`
  - `apps/payment-app/src/payments/payments.controller.ts`
  - `apps/payment-app/src/payments/payments.service.ts`
  - `apps/payment-app/src/payments/payments.module.ts`
  - `apps/payment-app/prisma/schema.prisma`
  - `libs/shared/dto/payment.dto.ts`
  - `apps/gateway/src/payments/payments.controller.ts`

---

## Overview

**Payment App** là microservice xử lý thanh toán trong hệ thống E-commerce, hỗ trợ hai phương thức thanh toán:

1. **COD (Cash on Delivery)** - Thanh toán khi nhận hàng
2. **SePay** - Chuyển khoản ngân hàng qua SePay payment gateway

### Core Responsibilities

- **Payment Processing**: Xử lý thanh toán cho orders (COD & SePay)
- **Payment Verification**: Xác thực thanh toán từ gateway callback
- **Webhook Handling**: Nhận và xử lý webhook từ SePay khi có giao dịch
- **Transaction Tracking**: Lưu trữ lịch sử giao dịch từ SePay
- **Order Status Sync**: Cập nhật trạng thái order sang PAID sau khi thanh toán thành công

### Architecture Position

```
Client → Gateway (REST) → NATS → Payment Service → payment_db (PostgreSQL)
                            ↓
                      Order Service (validate & update order)

SePay Gateway → Webhook → Gateway → NATS → Payment Service
```

### Key Features

- **Idempotent Webhook Processing**: Xử lý duplicate webhooks an toàn
- **Microservices Communication**: Tích hợp với Order Service qua NATS
- **Multiple Payment Methods**: COD (instant) và SePay (async with webhook)
- **Transaction History**: Lưu trữ tất cả giao dịch từ SePay
- **Fire-and-Forget Order Updates**: Không block payment flow khi update order

---

## Implementation Details

### 1. Service Bootstrap (`main.ts`)

```typescript
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(PaymentAppModule, {
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
      queue: 'payment-app',
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global RPC exception filter
  app.useGlobalFilters(new AllRpcExceptionsFilter());

  await app.listen();
}
```

**Configuration:**

- NATS transport với queue `payment-app`
- Global validation cho tất cả DTOs
- Global exception filter cho consistent error handling

### 2. Module Structure

```typescript
// payment-app.module.ts
@Module({
  imports: [PaymentsModule],
  providers: [PrismaService],
})
export class PaymentAppModule {}

// payments.module.ts
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

**Key Points:**

- Inject ORDER_SERVICE client để giao tiếp với Order Service
- Export PaymentsService để có thể test hoặc reuse

### 3. NATS Message Patterns

Controller xử lý 5 NATS message patterns:

| Pattern                 | Purpose                   | Input DTO           | Output Type              |
| ----------------------- | ------------------------- | ------------------- | ------------------------ |
| `payment.webhook.sepay` | Nhận webhook từ SePay     | `SePayWebhookDto`   | `SePayWebhookResponse`   |
| `payment.process`       | Xử lý thanh toán          | `PaymentProcessDto` | `PaymentProcessResponse` |
| `payment.verify`        | Verify payment từ gateway | `PaymentVerifyDto`  | `PaymentVerifyResponse`  |
| `payment.getById`       | Lấy payment theo ID       | `PaymentIdDto`      | `PaymentResponse`        |
| `payment.getByOrder`    | Lấy payment theo order ID | `PaymentByOrderDto` | `PaymentResponse`        |

**Example NATS Handler:**

```typescript
@MessagePattern(EVENTS.PAYMENT.PROCESS)
process(@Payload() dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
  return this.paymentsService.process(dto);
}
```

### 4. Payment Processing Flow

#### COD Payment Flow

```
1. Client → Gateway: POST /payments/process { orderId, method: "COD", amountInt }
2. Gateway → Payment Service (NATS): payment.process
3. Payment Service:
   a. Validate order exists & status = PENDING (call Order Service)
   b. Create Payment record (status = UNPAID)
   c. Update Payment status → PAID
   d. Update Order status → PAID (fire-and-forget)
4. Return: { paymentId, status: "PAID", message }
```

**Code:**

```typescript
async process(dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
  // 1. Validate order
  await this.validateOrderForPayment(dto.orderId);

  // 2. Create payment
  const payment = await this.prisma.payment.create({
    data: {
      orderId: dto.orderId,
      method: dto.method,
      amountInt: dto.amountInt,
      status: PaymentStatus.UNPAID,
      payload: false,
    },
  });

  // 3. Handle COD
  if (dto.method === PaymentMethod.COD) {
    await this.completePayment(payment.id, dto.orderId);
    return {
      paymentId: payment.id,
      status: 'PAID',
      message: 'COD payment processed successfully',
    };
  }

  // 4. Handle SePay
  const paymentUrl = `https://sepay.vn/payment/${payment.id}`;
  return {
    paymentId: payment.id,
    status: 'UNPAID',
    paymentUrl,
    message: 'Redirect to payment gateway',
  };
}
```

#### SePay Payment Flow

```
1. Client → Gateway: POST /payments/process { orderId, method: "SEPAY", amountInt }
2. Payment Service:
   a. Validate order
   b. Create Payment (status = UNPAID)
   c. Generate payment URL
3. Return: { paymentId, status: "UNPAID", paymentUrl }
4. Client redirects user to paymentUrl
5. User completes payment on SePay
6. SePay → Gateway: POST /payments/webhook/sepay (webhook)
7. Payment Service:
   a. Save Transaction record (idempotency check)
   b. Extract order ID from transaction content (regex: DH-123)
   c. Find matching Payment (orderId + amount + UNPAID)
   d. Update Payment → PAID
   e. Update Order → PAID (fire-and-forget)
8. Return: { success: true, orderId, paymentId }
```

### 5. SePay Webhook Handler

**Đặc điểm quan trọng:**

1. **Idempotency**: Webhook có thể gọi nhiều lần, phải xử lý duplicate
2. **Order ID Extraction**: Parse từ transaction content (pattern: `DH-123`, `DH123`)
3. **Transaction Matching**: Match by orderId + amount + status UNPAID
4. **Fire-and-Forget Order Update**: Không chờ Order Service response

**Implementation:**

```typescript
async handleSePayWebhook(dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
  // 1. Idempotency check
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

  // 2. Save transaction
  await this.prisma.transaction.create({
    data: {
      sePayId: dto.id,
      gateway: dto.gateway,
      transactionDate: new Date(dto.transactionDate),
      accountNumber: dto.accountNumber,
      subAccount: dto.subAccount,
      amountIn: dto.transferType === 'in' ? dto.transferAmount : 0,
      amountOut: dto.transferType === 'out' ? dto.transferAmount : 0,
      accumulated: dto.accumulated,
      code: dto.code,
      transactionContent: dto.content,
      referenceCode: dto.referenceCode,
      description: dto.description,
    },
  });

  // 3. Only process incoming transactions
  if (dto.transferType !== 'in') {
    return {
      success: true,
      message: 'Transaction saved (not an incoming payment)',
    };
  }

  // 4. Extract order ID from content
  const orderIdMatch = /DH[-_]?(\d+)/i.exec(dto.content);
  if (!orderIdMatch) {
    return {
      success: true,
      message: 'Transaction saved (no order ID in content)',
    };
  }
  const orderId = orderIdMatch[1];

  // 5. Find matching payment
  const payment = await this.prisma.payment.findFirst({
    where: {
      orderId,
      amountInt: dto.transferAmount,
      status: 'UNPAID',
    },
  });

  if (!payment) {
    return {
      success: true,
      message: 'Transaction saved (no matching unpaid payment)',
    };
  }

  // 6. Update payment status
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

  // 7. Update order status (fire-and-forget)
  firstValueFrom(
    this.orderClient.send(EVENTS.ORDER.UPDATE_STATUS, {
      id: orderId,
      status: 'PAID',
    }).pipe(timeout(5000), catchError(error => {
      console.error('Failed to update order status:', error);
      return throwError(() => new Error('Failed to update order status'));
    }))
  ).catch(() => {
    // Ignore errors
  });

  return {
    success: true,
    message: 'Payment processed successfully',
    orderId,
    paymentId: payment.id,
  };
}
```

**Webhook Payload Example:**

```json
{
  "id": 123456,
  "gateway": "VIETCOMBANK",
  "transactionDate": "2025-10-30 14:30:00",
  "accountNumber": "1234567890",
  "code": null,
  "content": "Chuyen khoan don hang DH-123",
  "transferType": "in",
  "transferAmount": 50000,
  "accumulated": 1000000,
  "subAccount": null,
  "referenceCode": "FT25103012345678",
  "description": "Nhan tien"
}
```

### 6. Payment Verification Flow

Used khi client cần verify payment status từ gateway callback URL:

```typescript
async verify(dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
  // 1. Find payment by orderId
  const payment = await this.prisma.payment.findFirst({
    where: { orderId: dto.orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) {
    throw new EntityNotFoundRpcException('Payment', dto.orderId);
  }

  // 2. Verify gateway payload (mock verification)
  const isValid = this.mockVerifyPaymentGateway(dto.payload);

  if (!isValid) {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'UNPAID', payload: dto.payload },
    });
    return {
      paymentId: payment.id,
      orderId: dto.orderId,
      status: PaymentStatus.UNPAID,
      verified: false,
      message: 'Payment verification failed',
    };
  }

  // 3. Complete payment
  await this.completePayment(payment.id, dto.orderId);

  return {
    paymentId: payment.id,
    orderId: dto.orderId,
    status: PaymentStatus.PAID,
    verified: true,
    transactionId: dto.payload.transactionId || payment.id,
    message: 'Payment verified successfully',
  };
}
```

### 7. Order Validation & Status Update

**Validate Order trước khi xử lý thanh toán:**

```typescript
private async validateOrderForPayment(orderId: string): Promise<void> {
  try {
    const order = await firstValueFrom(
      this.orderClient.send(EVENTS.ORDER.GET, { id: orderId }).pipe(
        timeout(5000),
        catchError(error => {
          if (error.name === 'TimeoutError') {
            return throwError(() =>
              new ValidationRpcException('Order service không phản hồi')
            );
          }
          return throwError(() =>
            new EntityNotFoundRpcException('Order', orderId)
          );
        }),
      )
    );

    if (order.status !== OrderStatus.PENDING) {
      throw new ValidationRpcException(
        `Cannot process payment for order with status: ${order.status}`
      );
    }
  } catch (error) {
    if (error instanceof EntityNotFoundRpcException ||
        error instanceof ValidationRpcException) {
      throw error;
    }
    throw new ValidationRpcException('Failed to validate order');
  }
}
```

**Update Order Status (Fire-and-Forget):**

```typescript
private async completePayment(paymentId: string, orderId: string): Promise<void> {
  // 1. Update payment
  await this.prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID' },
  });

  // 2. Update order (fire-and-forget)
  firstValueFrom(
    this.orderClient.send(EVENTS.ORDER.UPDATE_STATUS, {
      id: orderId,
      status: 'PAID',
    }).pipe(
      timeout(5000),
      catchError(error => {
        console.error('Failed to update order status:', error);
        return throwError(() => new Error('Failed to update order status'));
      })
    )
  ).catch(() => {
    // Ignore errors - payment already completed
  });
}
```

**Fire-and-Forget Pattern:**

- Payment success không phụ thuộc vào Order update
- Log errors nhưng không throw
- Payment đã hoàn tất, Order update là eventual consistency

---

## Database Schema

### Payment Table

```prisma
model Payment {
  id        String          @id @default(cuid())
  orderId   String
  method    PaymentMethod   // COD | SEPAY
  amountInt Int             // Amount in cents
  status    PaymentStatus   @default(UNPAID) // UNPAID | PAID
  payload   Json?           // Gateway response data
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

enum PaymentMethod {
  COD
  SEPAY
}

enum PaymentStatus {
  UNPAID
  PAID
}
```

**Key Points:**

- `orderId` không phải unique key (có thể có nhiều payment attempts)
- `amountInt` stored in cents để tránh floating point issues
- `payload` lưu raw data từ gateway (flexible JSON)
- `status` chỉ có 2 states: UNPAID/PAID (simple state machine)

### Transaction Table

```prisma
model Transaction {
  id                 String   @id @default(cuid())
  sePayId            Int      @unique  // SePay transaction ID (idempotency key)
  gateway            String             // Bank name (VIETCOMBANK, TECHCOMBANK, etc.)
  transactionDate    DateTime
  accountNumber      String
  subAccount         String?
  amountIn           Int      @default(0)
  amountOut          Int      @default(0)
  accumulated        Int      @default(0)
  code               String?
  transactionContent String             // Parse order ID from here
  referenceCode      String             // Bank reference code
  description        String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([sePayId])
  @@index([transactionDate])
}
```

**Key Points:**

- `sePayId` unique constraint để đảm bảo idempotency
- Lưu full transaction data từ SePay webhook
- `transactionContent` chứa order ID (parse bằng regex)
- Indexes trên `sePayId` và `transactionDate` cho performance

### Database Configuration

```env
DATABASE_URL_PAYMENT="postgresql://user:password@localhost:5437/payment_db"
```

Port: **5437** (mỗi service có database riêng)

---

## DTOs & Types

### PaymentProcessDto

```typescript
export class PaymentProcessDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod; // "COD" | "SEPAY"

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @IsPositive()
  amountInt: number; // Amount in cents
}
```

### SePayWebhookDto

```typescript
export class SePayWebhookDto {
  @IsNotEmpty()
  @IsNumber()
  id: number; // SePay transaction ID

  @IsNotEmpty()
  @IsString()
  gateway: string; // Bank name

  @IsNotEmpty()
  @IsString()
  transactionDate: string; // ISO format

  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsNotEmpty()
  @IsString()
  content: string; // Contains order ID

  @IsNotEmpty()
  @IsIn(['in', 'out'])
  transferType: 'in' | 'out';

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  transferAmount: number;

  @IsNotEmpty()
  @IsNumber()
  accumulated: number; // Total balance

  @IsOptional()
  @IsString()
  subAccount?: string | null;

  @IsNotEmpty()
  @IsString()
  referenceCode: string; // Bank reference

  @IsNotEmpty()
  @IsString()
  description: string;
}
```

### PaymentResponse

```typescript
export interface PaymentResponse {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amountInt: number;
  status: PaymentStatus;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### PaymentProcessResponse

```typescript
export interface PaymentProcessResponse {
  paymentId: string;
  status: 'PAID' | 'UNPAID';
  paymentUrl?: string; // Only for SePay
  message: string;
}
```

---

## Dependencies

### Internal Dependencies

```typescript
// Shared libraries
import { EVENTS } from '@shared/events';
import {
  PaymentProcessDto,
  PaymentVerifyDto,
  PaymentIdDto,
  PaymentByOrderDto,
  SePayWebhookDto,
} from '@shared/dto/payment.dto';
import {
  PaymentResponse,
  PaymentProcessResponse,
  PaymentVerifyResponse,
  PaymentMethod,
  PaymentStatus,
} from '@shared/types/payment.types';
import {
  EntityNotFoundRpcException,
  ValidationRpcException,
} from '@shared/exceptions/rpc-exceptions';
import { AllRpcExceptionsFilter } from '@shared/filters/rpc-exception.filter';

// Prisma
import { PrismaService } from '@payment-app/prisma/prisma.service';
```

### External Dependencies

```json
{
  "@nestjs/core": "^11.x",
  "@nestjs/common": "^11.x",
  "@nestjs/microservices": "^11.x",
  "@prisma/client": "^6.x",
  "class-validator": "^0.14.x",
  "class-transformer": "^0.5.x",
  "rxjs": "^7.x"
}
```

### Service-to-Service Communication

```mermaid
graph LR
    Payment[Payment Service] -->|NATS| Order[Order Service]
    Payment -->|GET order| Order
    Payment -->|UPDATE_STATUS| Order

    Gateway[API Gateway] -->|NATS| Payment
    SePay[SePay Gateway] -->|Webhook| Gateway
```

**NATS Messages Sent:**

- `EVENTS.ORDER.GET` - Validate order exists and status
- `EVENTS.ORDER.UPDATE_STATUS` - Update order to PAID

**NATS Messages Received:**

- `EVENTS.PAYMENT.WEBHOOK_SEPAY` - SePay webhook
- `EVENTS.PAYMENT.PROCESS` - Process payment
- `EVENTS.PAYMENT.VERIFY` - Verify payment
- `EVENTS.PAYMENT.GET_BY_ID` - Get payment by ID
- `EVENTS.PAYMENT.GET_BY_ORDER` - Get payment by order ID

---

## Gateway Integration

### REST Endpoints

Gateway expose REST APIs và forward đến Payment Service:

```typescript
// apps/gateway/src/payments/payments.controller.ts
@Controller('payments')
export class PaymentsController extends BaseGatewayController {
  constructor(@Inject('PAYMENT_SERVICE') protected readonly client: ClientProxy) {
    super(client);
  }

  // POST /payments/webhook/sepay
  @Post('webhook/sepay')
  sepayWebhook(@Body() dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
    return this.send<SePayWebhookDto, SePayWebhookResponse>(EVENTS.PAYMENT.WEBHOOK_SEPAY, dto);
  }

  // POST /payments/process
  @Post('process')
  process(@Body() dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
    return this.send<PaymentProcessDto, PaymentProcessResponse>(EVENTS.PAYMENT.PROCESS, dto);
  }

  // POST /payments/verify
  @Post('verify')
  verify(@Body() dto: PaymentVerifyDto): Promise<PaymentVerifyResponse> {
    return this.send<PaymentVerifyDto, PaymentVerifyResponse>(EVENTS.PAYMENT.VERIFY, dto);
  }

  // GET /payments/order/:orderId
  @Get('order/:orderId')
  findByOrder(@Param('orderId') orderId: string): Promise<PaymentResponse> {
    return this.send<{ orderId: string }, PaymentResponse>(EVENTS.PAYMENT.GET_BY_ORDER, {
      orderId,
    });
  }

  // GET /payments/:id
  @Get(':id')
  findById(@Param('id') paymentId: string): Promise<PaymentResponse> {
    return this.send<{ paymentId: string }, PaymentResponse>(EVENTS.PAYMENT.GET_BY_ID, {
      paymentId,
    });
  }
}
```

**Authentication:**

- Tất cả endpoints (trừ webhook) require authentication tại Gateway
- Gateway attach `userId` vào NATS message (Perimeter Security model)
- Payment Service không có guards (trust Gateway)

---

## Visual Diagrams

### System Context Diagram

```mermaid
graph TB
    Client[Client/Browser]
    Gateway[API Gateway]
    PaymentService[Payment Service]
    OrderService[Order Service]
    PaymentDB[(Payment DB)]
    OrderDB[(Order DB)]
    SePay[SePay Gateway]
    NATS[NATS Message Broker]

    Client -->|HTTP REST| Gateway
    SePay -->|Webhook| Gateway
    Gateway <-->|NATS| NATS
    NATS <-->|NATS| PaymentService
    NATS <-->|NATS| OrderService
    PaymentService -->|Prisma| PaymentDB
    OrderService -->|Prisma| OrderDB

    style PaymentService fill:#e1f5ff
    style PaymentDB fill:#fff4e1
```

### COD Payment Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant P as Payment Service
    participant O as Order Service
    participant DB as Payment DB

    C->>G: POST /payments/process<br/>{orderId, method: "COD", amountInt}
    G->>P: NATS: payment.process
    P->>O: NATS: order.get {orderId}
    O-->>P: {id, status: "PENDING", ...}
    P->>DB: Create Payment (status: UNPAID)
    DB-->>P: Payment created
    P->>DB: Update Payment (status: PAID)
    P->>O: NATS: order.updateStatus {id, status: "PAID"}
    Note over P,O: Fire-and-forget (async)
    P-->>G: {paymentId, status: "PAID"}
    G-->>C: 200 OK
```

### SePay Payment Sequence

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant P as Payment Service
    participant O as Order Service
    participant DB as Payment DB
    participant S as SePay Gateway

    Note over C,S: Step 1: Create Payment
    C->>G: POST /payments/process<br/>{orderId, method: "SEPAY", amountInt}
    G->>P: NATS: payment.process
    P->>O: NATS: order.get {orderId}
    O-->>P: {id, status: "PENDING"}
    P->>DB: Create Payment (status: UNPAID)
    DB-->>P: Payment created
    P-->>G: {paymentId, status: "UNPAID", paymentUrl}
    G-->>C: 200 OK {paymentUrl}

    Note over C,S: Step 2: User Pays
    C->>S: Redirect to paymentUrl
    Note over S: User transfers money<br/>with order ID in content
    S-->>C: Payment completed

    Note over C,S: Step 3: Webhook Processing
    S->>G: POST /payments/webhook/sepay<br/>{id, content: "DH-123", transferAmount}
    G->>P: NATS: payment.webhook.sepay
    P->>DB: Check duplicate (sePayId)
    P->>DB: Save Transaction
    P->>DB: Find Payment<br/>(orderId, amount, UNPAID)
    P->>DB: Update Payment (status: PAID)
    P->>O: NATS: order.updateStatus<br/>{id, status: "PAID"}
    Note over P,O: Fire-and-forget
    P-->>G: {success: true, orderId, paymentId}
    G-->>S: 200 OK
```

### Payment Verify Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant P as Payment Service
    participant O as Order Service
    participant DB as Payment DB

    C->>G: POST /payments/verify<br/>{orderId, payload}
    G->>P: NATS: payment.verify
    P->>DB: Find Payment by orderId
    DB-->>P: Payment (status: UNPAID)
    Note over P: Verify gateway payload
    alt Valid Payment
        P->>DB: Update Payment (status: PAID)
        P->>O: NATS: order.updateStatus<br/>(fire-and-forget)
        P-->>G: {verified: true, status: "PAID"}
    else Invalid Payment
        P->>DB: Update Payment (payload)
        P-->>G: {verified: false, status: "UNPAID"}
    end
    G-->>C: 200 OK
```

### Data Flow Diagram

```mermaid
graph LR
    subgraph "Payment Service"
        Controller[Payments Controller]
        Service[Payments Service]
        Prisma[Prisma Client]

        Controller -->|@MessagePattern| Service
        Service -->|Query/Update| Prisma
    end

    subgraph "Payment DB"
        PaymentTable[(Payment Table)]
        TransactionTable[(Transaction Table)]

        Prisma -->|Read/Write| PaymentTable
        Prisma -->|Read/Write| TransactionTable
    end

    subgraph "External Services"
        OrderService[Order Service]
        SePay[SePay Gateway]
    end

    Service -->|NATS: order.get<br/>order.updateStatus| OrderService
    SePay -->|Webhook| Controller

    style Service fill:#e1f5ff
    style PaymentTable fill:#fff4e1
    style TransactionTable fill:#fff4e1
```

---

## Error Handling

### RPC Exceptions

Payment Service sử dụng custom RPC exceptions từ `@shared/exceptions`:

```typescript
// Entity not found (404)
throw new EntityNotFoundRpcException('Payment', paymentId);

// Validation error (400)
throw new ValidationRpcException('Cannot process payment for order with status: PAID');

// Generic error
throw new ValidationRpcException('Failed to process payment');
```

### Error Handling Patterns

**1. Try-Catch với Specific Exceptions:**

```typescript
async process(dto: PaymentProcessDto): Promise<PaymentProcessResponse> {
  try {
    await this.validateOrderForPayment(dto.orderId);
    // ... business logic
  } catch (error) {
    // Rethrow known exceptions
    if (error instanceof EntityNotFoundRpcException ||
        error instanceof ValidationRpcException) {
      throw error;
    }
    // Wrap unknown errors
    console.error('[PaymentsService] process error:', error);
    throw new ValidationRpcException('Failed to process payment');
  }
}
```

**2. NATS Timeout & Retry:**

```typescript
const order = await firstValueFrom(
  this.orderClient.send(EVENTS.ORDER.GET, { id: orderId }).pipe(
    timeout(5000), // Timeout sau 5s
    catchError(error => {
      if (error.name === 'TimeoutError') {
        return throwError(() => new ValidationRpcException('Order service không phản hồi'));
      }
      return throwError(() => new EntityNotFoundRpcException('Order', orderId));
    }),
  ),
);
```

**3. Fire-and-Forget Error Handling:**

```typescript
firstValueFrom(
  this.orderClient
    .send(EVENTS.ORDER.UPDATE_STATUS, {
      id: orderId,
      status: 'PAID',
    })
    .pipe(
      timeout(5000),
      catchError(error => {
        console.error('Failed to update order status:', error);
        return throwError(() => new Error('Failed to update order status'));
      }),
    ),
).catch(() => {
  // Ignore errors - payment already completed
  // Order update sẽ được sync sau bằng cách khác
});
```

**4. Webhook Error Handling:**

```typescript
async handleSePayWebhook(dto: SePayWebhookDto): Promise<SePayWebhookResponse> {
  try {
    // ... process webhook
    return {
      success: true,
      message: 'Payment processed successfully',
      orderId,
      paymentId: payment.id,
    };
  } catch (error) {
    console.error('[PaymentsService] handleSePayWebhook error:', error);

    // CRITICAL: Return success to SePay để avoid retry
    // Webhook data đã được logged, có thể xử lý manual
    return {
      success: false,
      message: 'Internal error processing webhook',
    };
  }
}
```

---

## Testing

### Unit Tests

File: `apps/payment-app/src/payments/payments.service.spec.ts`

**Test Structure:**

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
              update: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              findUnique: jest.fn(),
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

  // Tests...
});
```

### E2E Tests

File: `apps/payment-app/test/payments.e2e-spec.ts`

**Test Coverage:**

1. **COD Payment Processing**

   ```typescript
   it('should process COD payment', async () => {
     const dto: PaymentProcessDto = {
       orderId: 'order-123',
       method: 'COD',
       amountInt: 50000,
     };

     const result = await firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto));

     expect(result.status).toBe('PAID');
     expect(result.paymentId).toBeDefined();
   });
   ```

2. **SePay Payment Processing**

   ```typescript
   it('should process SePay payment', async () => {
     const dto: PaymentProcessDto = {
       orderId: 'order-123',
       method: 'SEPAY',
       amountInt: 50000,
     };

     const result = await firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto));

     expect(result.status).toBe('UNPAID');
     expect(result.paymentUrl).toBeDefined();
   });
   ```

3. **Webhook Idempotency**

   ```typescript
   it('should handle duplicate webhook', async () => {
     const dto: SePayWebhookDto = {
       id: 123456,
       gateway: 'VIETCOMBANK',
       // ... other fields
     };

     // First call
     await firstValueFrom(client.send(EVENTS.PAYMENT.WEBHOOK_SEPAY, dto));

     // Second call (duplicate)
     const result = await firstValueFrom(client.send(EVENTS.PAYMENT.WEBHOOK_SEPAY, dto));

     expect(result.message).toContain('duplicate webhook');
   });
   ```

4. **Error Cases**
   ```typescript
   it('should throw error for non-existent order', async () => {
     const dto: PaymentProcessDto = {
       orderId: 'non-existent',
       method: 'COD',
       amountInt: 50000,
     };

     await expectRpcError(
       firstValueFrom(client.send(EVENTS.PAYMENT.PROCESS, dto)),
       'Failed to validate order',
     );
   });
   ```

### Test Helpers

```typescript
import { expectRpcError, expectRpcErrorWithStatus } from '@shared/testing/rpc-test-helpers';

// Check for any RPC error
await expectRpcError(promise, 'Expected error message substring');

// Check for specific HTTP status
await expectRpcErrorWithStatus(promise, 404, 'không tồn tại');
```

---

## Additional Insights

### Security Considerations

1. **Perimeter Security Model**
   - Gateway verifies JWT và attach userId
   - Payment Service trust messages từ Gateway
   - Không có AuthGuard trong microservice controllers

2. **Webhook Security**
   - TODO: Implement signature verification từ SePay
   - Current: Trust Gateway endpoint protection
   - Recommendation: Add SePay webhook signature validation

3. **Idempotency**
   - Webhook handlers MUST be idempotent
   - Duplicate webhooks được detected bằng `sePayId` unique constraint
   - Return success cho duplicate để avoid retry storm

### Performance Considerations

1. **Database Indexes**

   ```prisma
   @@index([sePayId])
   @@index([transactionDate])
   ```

   - Fast lookup cho duplicate detection
   - Fast query cho transaction history

2. **Fire-and-Forget Pattern**
   - Order status update không block payment completion
   - Log errors nhưng không fail payment
   - Trade-off: Eventual consistency vs immediate consistency

3. **NATS Timeout & Retry**
   - Timeout 5s cho inter-service calls
   - No retry cho idempotent operations
   - Avoid cascade failures

### Data Consistency

1. **Payment → Order Sync**
   - Payment PAID → Order PAID (fire-and-forget)
   - Nếu Order update fail: Payment vẫn PAID, Order vẫn PENDING
   - Resolution: Background job để sync inconsistent states

2. **Transaction History**
   - All SePay webhooks được saved (audit trail)
   - Có thể reconcile payments từ transaction history
   - Transaction table là source of truth cho financial data

### Scalability

1. **Stateless Service**
   - Không có in-memory state
   - Có thể scale horizontal dễ dàng
   - NATS queue `payment-app` distribute load

2. **Database Connection Pooling**
   - Prisma manage connection pool tự động
   - Configure max connections trong production

3. **NATS Queue Group**
   - Multiple instances share queue `payment-app`
   - Load balancing automatic

### Monitoring & Observability

**Key Metrics to Monitor:**

1. Payment success rate (COD vs SePay)
2. Webhook processing time
3. Order service timeout rate
4. Payment → Order sync lag
5. Duplicate webhook rate

**Log Important Events:**

```typescript
console.log('[PaymentsService] Payment completed: orderId=..., paymentId=...');
console.log('[PaymentsService] Duplicate webhook ignored: sePayId=...');
console.error('[PaymentsService] Failed to update order status:', error);
```

### Known Limitations

1. **Mock Payment Gateway Verification**
   - Current: Simple boolean check
   - Production: Need real gateway API integration

2. **No Payment Refund**
   - Current: Only support payment creation
   - Future: Add refund support

3. **No Payment Retry Mechanism**
   - Failed payments phải manually retry
   - Future: Add automatic retry với exponential backoff

4. **Single Currency**
   - Current: Only VND (Vietnam Dong)
   - Future: Multi-currency support

---

## Next Steps

### For Developers

1. **Implement Real SePay Integration**
   - Replace mock verification với real API calls
   - Add signature verification cho webhooks
   - Test với SePay sandbox environment

2. **Add Payment Refund Feature**
   - Create new NATS event: `payment.refund`
   - Update Payment schema với `REFUNDED` status
   - Integrate với Order cancellation flow

3. **Implement Consistency Checker**
   - Background job để detect Payment PAID nhưng Order PENDING
   - Auto-sync inconsistent states
   - Alert cho manual review

4. **Add More Payment Methods**
   - VNPay, MoMo, ZaloPay integrations
   - Update PaymentMethod enum
   - Adapter pattern cho multiple gateways

### For Testing

1. **Integration Tests với Real NATS**
   - Test full flow: Gateway → NATS → Payment → Order
   - Test concurrent webhook processing
   - Test timeout scenarios

2. **Load Testing**
   - Simulate high webhook volume
   - Test database connection pool limits
   - Measure response times under load

3. **Chaos Testing**
   - Simulate Order service downtime
   - Test webhook retry behavior
   - Validate data consistency after failures

### For Documentation

1. **API Documentation**
   - Add OpenAPI/Swagger specs cho Gateway endpoints
   - Document webhook payload format
   - Add example requests/responses

2. **Runbook**
   - Payment stuck troubleshooting guide
   - Webhook replay procedure
   - Data consistency recovery steps

3. **Architecture Decision Records (ADR)**
   - Document why fire-and-forget cho order updates
   - Document webhook idempotency strategy
   - Document payment gateway selection criteria

---

## References

- **SePay Documentation**: https://docs.sepay.vn/tich-hop-webhooks.html
- **NestJS Microservices**: https://docs.nestjs.com/microservices/basics
- **Prisma Documentation**: https://www.prisma.io/docs
- **NATS Documentation**: https://docs.nats.io/

## Related Knowledge Files

- `knowledge-order-app.md` - Order service integration
- `knowledge-gateway.md` - Gateway routing và authentication
- `knowledge-nats-communication.md` - NATS patterns và best practices

---

**Analysis Complete** ✅

This knowledge base covers the complete Payment App microservice implementation, from high-level architecture to low-level implementation details. Use this as a reference for development, debugging, and onboarding new team members.
