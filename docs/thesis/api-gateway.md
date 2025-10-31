# Tài Liệu Kỹ Thuật: API Gateway

> Tài liệu luận văn tốt nghiệp - Hệ thống E-commerce Microservices  
> Service: Gateway App (`apps/gateway`)  
> Ngày phân tích: 31/10/2025  
> Phạm vi: API Gateway (REST) → NATS → Microservices, Perimeter Security, Health Checks, Error Mapping

---

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Kiến Trúc & Thiết Kế](#2-kiến-trúc--thiết-kế)
3. [Routing Modules & Endpoints](#3-routing-modules--endpoints)
4. [Authentication & Authorization](#4-authentication--authorization)
5. [NATS Communication](#5-nats-communication)
6. [Error Handling](#6-error-handling)
7. [Middleware & Security](#7-middleware--security)
8. [Health Checks](#8-health-checks)
9. [Environment & Configuration](#9-environment--configuration)
10. [Deployment & Running](#10-deployment--running)
11. [Testing Strategy](#11-testing-strategy)
12. [Khuyến Nghị & Nâng Cấp](#12-khuyến-nghị--nâng-cấp)
13. [Kết Luận](#13-kết-luận)

---

## 1. Tổng Quan

### 1.1. Vai Trò

API Gateway là điểm vào duy nhất (single entry point) của client (Web/Mobile), cung cấp REST API và forward yêu cầu đến các microservices qua NATS. Gateway đồng thời là lớp an ninh và điều tiết lưu lượng (perimeter security), chịu trách nhiệm:

- Xác thực/ủy quyền (verify JWT, kiểm tra role) ở ngay Gateway
- Định tuyến API theo domain (auth, users, products, orders, payments, cart, addresses, ar)
- Chuẩn hóa và ánh xạ lỗi RPC → HTTP
- Giới hạn tốc độ (rate limiting) và ghi log truy cập (audit log)
- Health checks cho hệ thống (readiness, liveness, services)

### 1.2. Kiến Trúc Tổng Thể

```
Client (Web/Mobile)
     │  HTTP/REST
     ▼
┌──────────────┐        NATS Request/Response         ┌─────────────────┐
│  API Gateway │ ───────────────────────────────────▶ │  NATS Broker    │
│  (NestJS)    │ ◀─────────────────────────────────── │                 │
└──────┬───────┘                                      └───────┬─────────┘
       │   Health/Monitoring                                   │
       ▼                                                        ▼
  Readiness/Liveness     ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌─────────┐
                         │user-app │  │product   │  │order-app │  │payment  │  │cart-app │
                         └─────────┘  └──────────┘  └──────────┘  └─────────┘  └─────────┘
                                           ▲               ▲             ▲            ▲
                                           └───────────────┴─────────────┴────────────┘
                                               (request/response qua EVENTS.*)
```

### 1.3. Tech Stack

- Framework: NestJS v11.x (HTTP server)
- Runtime: Node.js v20+
- Language: TypeScript v5.x
- Message Broker: NATS v2.29 (request/response)
- Validation: class-validator (Global ValidationPipe)
- JWT: jose (RSA Public Key verify) qua `@shared/jwt`
- Health: @nestjs/terminus
- Async: RxJS operators (timeout, retry, catchError)

### 1.4. Cấu Hình Cổng

```
HTTP Port: 3000
NATS URL: nats://localhost:4222
CORS: cấu hình từ env (danh sách origin, comma-separated)
```

---

## 2. Kiến Trúc & Thiết Kế

### 2.1. AppModule & Bootstrap

File: apps/gateway/src/main.ts, apps/gateway/src/app.module.ts

```ts
// apps/gateway/src/main.ts
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(` [Gateway] is running on http://localhost:${port}`);
}
```

```ts
// apps/gateway/src/app.module.ts
@Module({
  imports: [
    JwtModule,
    TerminusModule,
    GatewayClientsModule, // đăng ký NATS clients toàn cục
    AuthModule,
    UsersModule,
    AddressesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ArModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLogMiddleware, RateLimitMiddleware).forRoutes('*');
  }
}
```

Điểm nhấn:

- Global ValidationPipe bảo vệ đầu vào, biến đổi DTO tự động
- CORS bật toàn cục, đọc danh sách origin từ env
- Middleware chu vi an ninh: AuditLog → RateLimit cho mọi route

### 2.2. GatewayClientsModule (NATS Clients)

File: apps/gateway/src/gateway-clients.module.ts

```ts
@Global()
@Module({
  imports: [
    ClientsModule.register([
      { name: 'USER_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'user-app' } },
      { name: 'PRODUCT_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'product-app' } },
      { name: 'ORDER_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'order-app' } },
      { name: 'PAYMENT_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'payment-app' } },
      { name: 'CART_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'cart-app' } },
      { name: 'REPORT_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'report-app' } },
      { name: 'AR_SERVICE', transport: Transport.NATS, options: { servers: [NATS], queue: 'ar-app' } },
    ]),
  ],
  exports: [ClientsModule],
})
export class GatewayClientsModule {}
```

Quy ước `queue` tương ứng với group tiêu thụ của từng microservice, cho phép load balancing.

### 2.3. BaseGatewayController (Template Method)

File: apps/gateway/src/base.controller.ts

```ts
export abstract class BaseGatewayController {
  constructor(protected readonly client: ClientProxy) {}

  protected async send<TReq, TRes>(pattern: string, data: TReq, options: SendOptions = {}): Promise<TRes> {
    const { timeout: timeoutMs = 5000, retryCount = 1, retryDelay = 1000 } = options;

    return firstValueFrom(
      this.client.send<TRes, TReq>(pattern, data).pipe(
        timeout(timeoutMs),
        retry({ count: retryCount, delay: retryDelay }),
        catchError((error: unknown) => throwError(() => this.createHttpError(error, pattern))),
      ),
    );
  }

  protected emit<TEvent>(pattern: string, data: TEvent): void {
    this.client.emit<void, TEvent>(pattern, data);
  }

  // ... convert RPC errors → HttpException (timeout, statusCode, message)
}
```

Lợi ích:

- Chuẩn hóa timeout/retry/log lỗi cho tất cả controllers
- Đảm bảo mapping lỗi RPC → HTTP thống nhất

---

## 3. Routing Modules & Endpoints

Mỗi domain có module và controller riêng, tất cả extends `BaseGatewayController` và forward sang NATS patterns định nghĩa tại `libs/shared/events.ts`.

Tổng quan module: apps/gateway/src

```
auth/       users/      addresses/   products/   categories/   cart/   orders/   payments/   ar/
```

Ví dụ chính:

- AuthController (apps/gateway/src/auth/auth.controller.ts)
  - POST `/auth/register` → `EVENTS.AUTH.REGISTER`
  - POST `/auth/login` → `EVENTS.AUTH.LOGIN`
  - POST `/auth/refresh` → `EVENTS.AUTH.REFRESH`
  - POST `/auth/verify` → `EVENTS.AUTH.VERIFY`
  - GET `/auth/me` → verify JWT tại Gateway, sau đó `USER.FIND_BY_ID`

- UsersController (apps/gateway/src/users/users.controller.ts)
  - GET `/users` (admin) → `USER.LIST`
  - GET `/users/email/:email` (admin) → `USER.FIND_BY_EMAIL`
  - GET `/users/:id` (admin) → `USER.FIND_BY_ID`
  - PUT `/users/:id` (auth) → `USER.UPDATE`
  - PUT `/users/:id/deactivate` (auth) → `USER.DEACTIVATE`

- ProductsController (apps/gateway/src/products/products.controller.ts)
  - GET `/products` → `PRODUCT.LIST`
  - GET `/products/slug/:slug` → `PRODUCT.GET_BY_SLUG` (đặt TRƯỚC `:id` tránh conflict)
  - GET `/products/:id` → `PRODUCT.GET_BY_ID`
  - POST `/products` (admin) → `PRODUCT.CREATE`
  - PUT `/products/:id` (admin) → `PRODUCT.UPDATE` ({ id, dto })
  - DELETE `/products/:id` (admin) → `PRODUCT.DELETE`

- CategoriesController (apps/gateway/src/products/categories.controller.ts)
  - Tương tự Product (LIST/GET_BY_SLUG/GET_BY_ID/CREATE/UPDATE/DELETE)

- AddressesController (apps/gateway/src/addresses/addresses.controller.ts)
  - GET `/addresses` (auth) → `ADDRESS.LIST_BY_USER` (trích userId từ JWT)
  - POST `/addresses` (auth) → `ADDRESS.CREATE` ({ userId, dto })
  - PUT `/addresses/:id` (auth) → `ADDRESS.UPDATE` ({ id, dto })
  - DELETE `/addresses/:id` (auth) → `ADDRESS.DELETE`
  - PUT `/addresses/:id/set-default` (auth) → `ADDRESS.SET_DEFAULT` ({ userId, addressId })

- CartController (apps/gateway/src/cart/cart.controller.ts) [auth]
  - GET `/cart` → `CART.GET`
  - POST `/cart/items` → `CART.ADD_ITEM`
  - PATCH `/cart/items` → `CART.UPDATE_ITEM`
  - DELETE `/cart/items` → `CART.REMOVE_ITEM`

- OrdersController (apps/gateway/src/orders/orders.controller.ts) [auth]
  - POST `/orders` → `ORDER.CREATE`
  - GET `/orders` → `ORDER.LIST`
  - GET `/orders/:id` → `ORDER.GET`
  - PUT `/orders/:id/status` → `ORDER.UPDATE_STATUS`
  - PUT `/orders/:id/cancel` → `ORDER.CANCEL`

- PaymentsController (apps/gateway/src/payments/payments.controller.ts)
  - POST `/payments/process` → `PAYMENT.PROCESS`
  - POST `/payments/verify` → `PAYMENT.VERIFY`
  - POST `/payments/confirm-cod/:orderId` → `PAYMENT.CONFIRM_COD`
  - GET `/payments/order/:orderId` → `PAYMENT.GET_BY_ORDER` (đặt TRƯỚC `:id` tránh conflict)
  - GET `/payments/:id` → `PAYMENT.GET_BY_ID`
  - POST `/payments/webhook/sepay` → `PAYMENT.WEBHOOK_SEPAY` (webhook từ SePay)

- AR Controller (apps/gateway/src/ar/ar.controller.ts)
  - POST `/ar/snapshots` (auth) → `AR.SNAPSHOT_CREATE`
  - GET `/ar/snapshots` (public) → `AR.SNAPSHOT_LIST`

---

## 4. Authentication & Authorization

### 4.1. Perimeter Security Model

```
┌─────────────────────────────────────────────────────────┐
│                     API GATEWAY                         │
│  AuthGuard: Verify JWT (RSA)  │ RolesGuard: RBAC        │
└───────────────────────┬────────┬────────────────────────┘
                        │        │ NATS payload (kèm userId)
                        ▼        ▼
┌─────────────────────────────────────────────────────────┐
│                   MICROSERVICES                         │
│         (Trust Gateway, no guards inside)               │
└─────────────────────────────────────────────────────────┘
```

Chỉ Gateway xác thực và kiểm tra role. Microservices nhận payload từ Gateway và tin cậy `userId`/`role` đã được kiểm tra.

### 4.2. AuthGuard (JWT Verify tại Gateway)

File: apps/gateway/src/auth/auth.guard.ts

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: Request = ctx.switchToHttp().getRequest();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Invalid authorization');

    const payload = await this.jwtService.verifyToken(token);
    if (!payload.sub || !payload.email || !payload.role) throw new UnauthorizedException('Invalid payload');

    req['user'] = { userId: payload.sub, email: payload.email, role: payload.role };
    return true;
  }
}
```

Lợi ích: Xác thực local bằng RSA Public Key (nhanh, không phụ thuộc mạng).

### 4.3. RolesGuard (RBAC)

File: apps/gateway/src/auth/roles.guard.ts

```ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true; // chỉ cần auth

    const req = ctx.switchToHttp().getRequest<Request & { user?: { role: UserRole } }>();
    if (!req.user?.role || !required.includes(req.user.role)) {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
```

---

## 5. NATS Communication

### 5.1. Event Patterns (Shared)

File: libs/shared/events.ts

```ts
export const EVENTS = {
  USER: { FIND_BY_ID: 'user.findById', LIST: 'user.list', ... },
  PRODUCT: { LIST: 'product.list', GET_BY_ID: 'product.getById', ... },
  ORDER: { CREATE: 'order.create', UPDATE_STATUS: 'order.updateStatus', ... },
  PAYMENT: { PROCESS: 'payment.process', WEBHOOK_SEPAY: 'payment.webhook.sepay', ... },
  // ...
} as const;
```

### 5.2. Request/Response với Timeout & Retry

File: apps/gateway/src/base.controller.ts

```ts
return firstValueFrom(
  this.client.send<TRes, TReq>(pattern, data).pipe(
    timeout(5000),
    retry({ count: 1, delay: 1000 }),
    catchError(error => throwError(() => this.createHttpError(error, pattern))),
  ),
);
```

Best practices:

- Luôn đặt `timeout` để tránh treo request
- `retry` 1 lần cho transient failure; log đầy đủ
- Pattern payload: kết hợp `path params + body dto` thành một object thống nhất khi cần

---

## 6. Error Handling

Tập trung tại `BaseGatewayController.createHttpError()`:

- Timeout (RxJS TimeoutError) → HTTP 408
- RPC errors format `{ message, statusCode }` → giữ nguyên `statusCode` (ví dụ 400/401/403/404/409/422/503)
- Lỗi không xác định → HTTP 500

Nguyên tắc:

- Microservices ném RPC exceptions chuẩn hóa (ValidationRpcException, EntityNotFoundRpcException, ...)
- Gateway convert và phản hồi HTTP consistent tới client

---

## 7. Middleware & Security

### 7.1. AuditLogMiddleware

File: apps/gateway/src/middleware/audit-log.middleware.ts

```ts
res.on('finish', () => {
  const duration = Date.now() - startTime;
  console.log(JSON.stringify({ timestamp, method, path, statusCode, duration, ip, userAgent, userId }));
});
```

- Ghi log cấu trúc JSON, dễ parse/indexing
- Khuyến nghị production: forward đến ELK / CloudWatch / GCP Logging

### 7.2. RateLimitMiddleware

File: apps/gateway/src/middleware/rate-limit.middleware.ts

```ts
// In-memory store (đơn giản cho thesis)
private store: { [key: string]: { count: number; resetTime: number } } = {};
private readonly maxRequests = 100; // per minute
```

Khuyến nghị production:

- Chuyển sang Redis-based token bucket để dùng chung giữa nhiều instances
- Tôn trọng `X-Forwarded-For` khi đứng sau reverse proxy/load balancer

### 7.3. CORS

- Mở theo `CORS_ORIGIN` (danh sách domain, phân tách bởi dấu phẩy)
- Production: Không dùng `*`; cần whitelisting domain cụ thể

---

## 8. Health Checks

File: apps/gateway/src/health.controller.ts

- `GET /health` → Ping NATS qua `MicroserviceHealthIndicator`
- `GET /health/ready` → Readiness probe (status, timestamp, uptime)
- `GET /health/live` → Liveness probe
- `GET /health/services` → Gửi `health_check` đến từng microservice, đo latency, tổng hợp trạng thái

Pseudocode kiểm tra service (theo mã nguồn hiện tại):

```ts
const start = Date.now();
await firstValueFrom(
  client.send({ cmd: 'health_check' }, {}).pipe(
    timeout(2000),
    catchError(() => of({ status: 'down' })) // giá trị này hiện không được kiểm tra
  )
);
return { status: 'up', latency: Date.now() - start };
```

Lưu ý: Do giá trị từ `catchError` chưa được kiểm tra, kết quả hiện tại luôn trả `status: 'up'` nếu Observable hoàn thành, kể cả khi service lỗi/timeout. Cần cải tiến nếu muốn phản ánh đúng trạng thái "down".

---

## 9. Environment & Configuration

File tham chiếu: .env.example

```env
PORT=3000
CORS_ORIGIN=*
NATS_URL=nats://localhost:4222

# JWT (RSA)
JWT_ALGORITHM=RS256
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Khóa RSA:

- Public key bắt buộc cho tất cả services (verify)
- Private key chỉ tồn tại ở user-app (sign)

---

## 10. Deployment & Running

Scripts (trích README):

```bash
# Development
pnpm run start:dev gateway

# Production
pnpm run build gateway
pnpm run start:prod gateway
```

Triển khai production:

- Scale out nhiều replicas Gateway → cần Rate Limit phân tán (Redis)
- Health endpoints tích hợp readiness/liveness probes (Kubernetes)
- Cấu hình CORS chặt chẽ theo domains thật

---

## 11. Testing Strategy

- Guard integration tests: `apps/gateway/src/auth/auth-roles.integration.spec.ts`
  - Kiểm tra thứ tự guard: AuthGuard (401) chạy trước RolesGuard (403)
  - Trường hợp role sai, thiếu user trong request, token sai/hết hạn
- Controller tests: kiểm tra mapping route → EVENTS và xử lý payload (kết hợp params + DTO)
- Health tests: verify `services` endpoint tổng hợp trạng thái hợp lệ với timeout

---

## 12. Khuyến Nghị & Nâng Cấp

1. Rate Limiting phân tán: dùng Redis + IP/Token buckets, tôn trọng `X-Forwarded-For`
2. Circuit Breaker & Bulkhead: cô lập lỗi service downstream, tránh lan rộng
3. Observability: structured logging + correlation id, metrics (Prometheus), tracing (OpenTelemetry)
4. API Documentation: sinh OpenAPI (Swagger) cho Gateway
5. Caching: cache danh mục/sản phẩm public (TTL) để giảm tải product-app
6. Webhook hardening: verify signature (SePay), idempotency keys
7. Security headers: thêm Helmet, hạn chế attack bề mặt ở Gateway
8. Request size limits: cấu hình chống payload quá lớn

---

## 13. Kết Luận

Gateway hiện thực đúng vai trò “perimeter” cho hệ thống microservices:

- Xác thực/ủy quyền tập trung, giảm gánh nặng cho microservices
- Chuẩn hóa giao tiếp REST ↔ NATS với timeout/retry/error mapping rõ ràng
- Có sẵn health checks và các cơ chế an ninh cơ bản (CORS, rate limit, audit logs)

Để production-ready, nên bổ sung rate limit phân tán, circuit breaker, quan sát/giám sát đầy đủ và hardening webhook/security headers.
