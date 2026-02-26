<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="NestJS Logo" />
</p>

<h1 align="center">E-Commerce Microservices Platform</h1>

<p align="center">
  <em><a href="./README.md">English</a> | <strong>Tiếng Việt</strong></em>
</p>

<p align="center">
  Hệ thống backend thương mại điện tử triển khai theo <strong>kiến trúc microservices</strong>, xây dựng bằng <strong>NestJS</strong>, <strong>NATS</strong>, <strong>Prisma</strong> và <strong>PostgreSQL</strong>.
</p>

<p align="center">
  Dự án thuộc hệ thống <strong>E-Commerce Microservices Platform</strong>. Xem thêm: <a href="https://github.com/HaoNgo232/Microservices-E-commerce-frontend">Frontend Repository</a>
</p>

<p align="center">
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://nestjs.com/"><img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white" alt="NestJS" /></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma" /></a>
  <a href="https://nats.io/"><img src="https://img.shields.io/badge/NATS-2.10-27AAE1?logo=nats.io&logoColor=white" alt="NATS" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white" alt="Docker" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Mục Lục

- [Tổng Quan Dự Án](#tổng-quan-dự-án)
- [Kiến Trúc](#kiến-trúc)
- [Công Nghệ Sử Dụng](#công-nghệ-sử-dụng)
- [Cấu Trúc Thư Mục](#cấu-trúc-thư-mục)
- [Hướng Dẫn Cài Đặt](#hướng-dẫn-cài-đặt)
- [Tài Liệu API](#tài-liệu-api)
- [Mô Hình Dữ Liệu](#mô-hình-dữ-liệu)
- [Cấu Hình](#cấu-hình)
- [Kiểm Thử](#kiểm-thử)
- [Docker & Triển Khai](#docker--triển-khai)
- [Luồng CI/CD](#luồng-cicd)
- [Tiêu Chuẩn Lập Trình](#tiêu-chuẩn-lập-trình)
- [Khắc Phục Sự Cố](#khắc-phục-sự-cố)
- [Đóng Góp](#đóng-góp)

---

## Tổng Quan Dự Án

Hệ thống backend thương mại điện tử này được xây dựng theo kiến trúc microservices cho một đề tài tốt nghiệp. Các nghiệp vụ (domains) chính bao gồm:

- **Quản lý Người Dùng** — Đăng ký, xác thực (JWT dùng mã hoá RSA), phân quyền (RBAC)
- **Danh Mục Kho Hàng** — Sản phẩm, danh mục, upload ảnh (với MinIO), tuỳ chỉnh slug, và hỗ trợ model 3D
- **Giỏ Hàng** — Quản lý giỏ hàng theo session, hỗ trợ gộp giỏ hàng khi người dùng chuyển sang trạng thái đăng nhập
- **Xử lý Đơn Hàng** — Toàn bộ vòng đời đơn hàng và theo dõi trạng thái giao hàng
- **Thanh Toán** — COD và chuyển khoản ngân hàng qua SePay (xác nhận thông qua webhook)
- **AR (Thực Tế Tăng Cường)** — Lưu chụp ảnh snapshot hỗ trợ tính năng ưu ướm thử (virtual try-on)
- **Báo Cáo Thống Kê** — Tổng hợp doanh thu, hiệu suất bán hàng và phân tích xu hướng người dùng

Mỗi domain hoạt động như một microservice riêng biệt với cơ sở dữ liệu PostgreSQL độc lập, giao tiếp với nhau thông qua message broker NATS.

---

## Kiến Trúc

### Sơ Đồ Tổng Quan

```
                          ┌─────────────────┐
                          │   Frontend App  │
                          │  (Vercel / SPA) │
                          └────────┬────────┘
                                   │ HTTPS
                          ┌────────▼────────┐
                          │  API Gateway    │
                          │  :3000 (HTTP)   │
                          │                 │
                          │ • JWT AuthGuard │
                          │ • Rate Limiting │
                          │ • Audit Logging │
                          │ • CORS / Pipes  │
                          └────────┬────────┘
                                   │ NATS (nats://localhost:4222)
         ┌─────────┬───────────┬───┴────┬──────────┬──────────┬──────────┐
         ▼         ▼           ▼        ▼          ▼          ▼          ▼
   ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ User     │ │ Product  │ │ Cart │ │ Order │ │Payment │ │   AR   │ │ Report │
   │ Service  │ │ Service  │ │ Svc  │ │  Svc  │ │  Svc   │ │  Svc   │ │  Svc   │
   └────┬─────┘ └────┬─────┘ └──┬───┘ └───┬───┘ └──┬─────┘ └──┬─────┘ └──┬─────┘
        │            │          │         │        │          │          │
   ┌────▼────┐  ┌────▼────┐ ┌───▼──┐ ┌────▼──┐ ┌───▼────┐ ┌───▼───┐ ┌────▼───┐
   │ user_db │  │prod_db  │ │cart  │ │order  │ │payment │ │ ar_db │ │report  │
   │ :5433   │  │ :5434   │ │_db   │ │_db    │ │_db     │ │ :5438 │ │_db     │
   │         │  │         │ │:5435 │ │:5436  │ │:5437   │ │       │ │:5439   │
   └─────────┘  └─────────┘ └──────┘ └───────┘ └────────┘ └───────┘ └────────┘
                      │
                ┌─────▼─────┐
                │   MinIO   │
                │ :9000/:01 │
                │ (Object   │
                │  Storage) │
                └───────────┘
```

### Mô Hình Bảo Mật — Perimeter Security

Hệ thống được thiết lập tính năng bảo mật Perimeter Security:

| Tầng (Layer) | Chức năng |
|:-------------|:----------|
| **API Gateway** | Xác thực mọi HTTP request đến từ bên ngoài thông qua `AuthGuard` (Kiểm tra token JWT) |
| **Middleware Stack** | `AuditLogMiddleware` → `RateLimitMiddleware` (Cản lọc: 100 req/min trên mỗi IP) |
| **NATS (Internal)** | Các microservice mặc định tin cậy message từ broker — không cài đặt riêng rẽ auth guard ở nội mạng |
| **Chiến lược JWT** | Mã hóa bất đối xứng RSA-256 — user-app tạo token thông qua private key; gateway xác minh chữ ký điện tử với public key (bắn đi khi init config bằng NATS) |

### Design Pattern Chính

- **API Gateway Pattern** — Điểm quy tụ entry duy nhất với cơ chế xử lý cross-cutting concerns (phân quyền, logging, routing, v.v)
- **Database-per-Service** — Mỗi microservice sỡ hữu database riêng, huỷ liên kết khóa ngoại cứng giữa các databases
- **Template Method** — BaseGatewayController thiết lập các chuẩn giao tiếp NATS với cấu hình xử lí lỗi chặn lại hoặc timeout retry
- **Message Queue Groups** — Tạo nhóm NATS group (`queue: 'service-name'`) cho phép cân bằng tải giữa các node chạy mở rộng
- **Event-Driven Communication** — Nhắn tin qua phương thức tuỳ chỉnh của channel NATS (request/reply và publish-subscribe event)

---

## Công Nghệ Sử Dụng

| Tầng | Công Nghệ | Vai Trò |
|:-----|:----------|:--------|
| **Cốt Lõi** | Node.js 20+ | Môi trường tính toán JavaScript |
| **Framework** | NestJS 11 | Backend API logic |
| **Ngôn Ngữ** | TypeScript 5.7 | Ràng buộc kiểu dữ liệu |
| **Message Broker** | NATS 2.10 | Kết nối liên hệ thống |
| **ORM** | Prisma 6 | Cầu nối Database linh hoạt |
| **Database** | PostgreSQL 16 | Relational data persistence |
| **Object Storage** | MinIO | Lưu trữ ảnh S3 tương thích |
| **Auth** | jose + @nestjs/jwt | Xác thực và chứng nhận JSON Web Token |
| **Validation** | class-validator & class-transformer | Trích ly và xác minh Payload |
| **Mã Hóa Mật Khẩu** | bcryptjs | Bảo vệ password |
| **Testing** | Jest 30 + Supertest | Integration code & E2E Testing |
| **Định dạng** | ESLint 9 + Prettier | Làm gọn source code |
| **Package Manager** | pnpm 10 | Trình quản lí module phụ thuộc |
| **Containerization** | Docker / Compose | Đóng gói Service image môi trường |
| **CI/CD** | GitHub Actions | Giám định deploy liên tục |
| **Health Checks** | @nestjs/terminus | Kubernetes probe ping |

---

## Cấu Trúc Thư Mục

Project xây dựng dựa trên kiến trúc NestJS monorepo quản lý qua `nest-cli.json` với 8 service phân vùng và 1 thư viện chia sẻ chung (shared library):

```
Microservices-E-commerce-backend
├── apps/                          # Application Code
│   ├── gateway/                   # API Gateway (HTTP → NATS)
│   │   └── src/
│   │       ├── main.ts               # Khởi chạy Express HTTP
│   │       ├── app.module.ts         # Module lớn nhất và middleware
│   │       ├── base.controller.ts    # Abstract controller NATS format
│   │       ├── gateway-clients.module.ts  # Export proxy liên kết NATS
│   │       ├── key-receiver.service.ts    # Nhận cấp quyền JWT public key
│   │       ├── health.controller.ts  # Endpoint Readiness cho giám sát
│   │       ├── auth/                 # Code xác minh Auth
│   │       ├── users/                # Proxy đẩy data User
│   │       ├── addresses/            # Proxy đẩy data Address
│   │       ├── products/             # Proxy đẩy data Product + Category
│   │       ├── cart/                 # Proxy giỏ hàng
│   │       ├── orders/               # Proxy đơn hàng
│   │       ├── payments/             # Proxy tài vụ SePay
│   │       ├── ar/                   # Proxy VR model
│   │       ├── middleware/           # Giới hạn API
│   │       └── filters/              # HTTP Exception lọc lỗi
│   │
│   ├── user-app/                  # User Microservice
│   │   ├── prisma/schema.prisma      # DB cấu trúc Người Dùng
│   │   └── src/                      # Xử lí Core (Auth, Address, Config)
│   │
│   ├── product-app/              # Product Microservice
│   │   ├── prisma/schema.prisma      # DB cấu trúc Vật Phẩm
│   │   └── src/                      # Sản phẩm quản lí, Upload dữ liệu, MinIO
│   │
│   ├── cart-app/                  # Cart Microservice
│   │   ├── prisma/schema.prisma      # DB Session Cart
│   │   └── src/                      # Cache Data hợp nhất giỏ
│   │
│   ├── order-app/                 # Order Microservice
│   │   ├── prisma/schema.prisma      # Lịch trình DB
│   │   └── src/                      # Thanh khoản và xác nhận hàng
│   │
│   ├── payment-app/              # Payment Microservice
│   │   ├── prisma/schema.prisma      # Mã giao dịch DB
│   │   └── src/                      # Logic Hook COD/SePay
│   │
│   ├── ar-app/                    # AR Microservice
│   │   ├── prisma/schema.prisma      # Cấu liệu hình ảnh DB
│   │   └── src/                      # Render hình tương thích
│   │
│   └── report-app/               # Reporting Microservice
│       ├── prisma/schema.prisma      # Thống kê phân tách DB
│       └── src/                      # Cập nhật số liệu
│
├── libs/                          # Thư Viện Chung
│   └── shared/                    # Library (@shared/*)
│       ├── main.ts                   # Export thư mục
│       ├── events.ts                 # File liệt kê hằng số cấu trúc tin (Message event pattern)
│       ├── config/                   # Hệ biến số môi trường
│       ├── dto/                      # File định chuẩn Data
│       ├── types/                    # Response Model
│       ├── filters/                  # Điều hướng các Exception RPC
│       └── exceptions/               # Quy chế gửi thông báo lỗi
│
├── docker/                        # Biểu đồ build Image Service riêng
│   ├── gateway/Dockerfile
│   └── microservices/*/Dockerfile
│
├── deploys/                       # Tệp môi trường cho Container
├── scripts/                       # Khởi chạy, Push Docker, Data mock
├── docs/                          # Kho dữ liệu tài liệu phụ trợ hệ thống
│
├── docker-compose.yml                # Script triển khai dev (7 DB + NATS + MinIO)
├── docker-compose.test.yml           # Script Testing
├── nest-cli.json                     # Biến Monorepo
├── package.json                      # Command Project
└── eslint.config.mjs / .prettierrc   # Cấu hình IDE Code
```

---

## Hướng Dẫn Cài Đặt

### Các Yêu Cầu Cài Đặt Trước

| Công cụ | Phiên bản | Tải tại |
|:-----|:--------|:-------------|
| **Node.js** | v20+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | v10+ | `npm install -g pnpm` |
| **Docker** | v24+ | [docker.com](https://www.docker.com/) |
| **Docker Compose** | v2+ | Cấp quyền từ Docker Desktop |

### Bước 1 — Clone Mã Nguồn

```bash
git clone https://github.com/HaoNgo232/Microservices-E-commerce-backend.git
cd Microservices-E-commerce-backend
pnpm install
```

### Bước 2 — Thiết Lập Môi Trường (Environment)

```bash
cp .env.example .env
```

Chỉnh sửa nội dung thông tin bên trong file `.env` nếu có thay đổi mật khẩu hoặc url định tuyến.

### Bước 3 — Tạo Khóa Bảo Mật RSA

Hệ thống yêu cầu có bộ mã khóa RSA để tiến hành xử lý logic JWT. Việc tạo khoá được thực hiện bằng script (User-Service sẽ dùng khóa private để khóa mã Token, API Gateway sẽ sử dụng khóa public để giải mã).

```bash
pnpm run generate:keys
```

### Bước 4 — Kích Hoạt Nền Tảng Server Base

```bash
# Khởi tạo NATS, Hệ quản trị CSDL PostgreSQL (7 Server) và MinIO Storage
docker compose up -d

# Xem xét các server đang ở trong trạng thái đã thiết lập
docker compose ps
```

### Bước 5 — Init Khởi Tạo Cấu Trúc Bảng Database

```bash
# Tự động xuất schema prisma đến cấu trúc client các module hệ thống
pnpm run db:gen:all

# Thực thi Migrate đồng bộ database schema DB gốc
pnpm run db:migrate:all
```

### Bước 6 — Khởi Chạy Toàn Bộ Các Microservice

```bash
# Chế độ khởi động Debug Development (hot-reload toàn cục 8 Service)
pnpm run dev:all
```

Khởi chạy cụ thể đơn lẻ 1 service (Dùng trong debug lỗi):

```bash
pnpm nest start --watch gateway
pnpm nest start --watch user-app
pnpm nest start --watch product-app
```

### Bước 7 — Check Readiness (Xác minh Server Sống)

```bash
# API Gateway Check status
curl http://localhost:3000/health

# Hiển thị list thông lượng liên kết từ trong network
curl http://localhost:3000/health/services
```

---

## Tài Liệu API

Toàn bộ Endpoint được ghim định tính tại **API Gateway** ở đường dẫn `http://localhost:3000`.

### Chứng Nhận Tài Khoản / Auth

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `POST` | `/auth/register` | Không | Cấp mới tài khoản cho User |
| `POST` | `/auth/login` | Không | Đăng nhập lấy Token Bearer |
| `POST` | `/auth/refresh` | Không | Đổi token hết hạn lấy Session Refresh |
| `POST` | `/auth/verify` | Không | Kiểm tra token hợp chuẩn |
| `GET` | `/auth/me` | Có | Xem thông tin tài khoản đang lưu ở thiết bị |

### Quản Trị Người Dùng

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `GET` | `/users` | Admin | Lấy lượng User đang có |
| `GET` | `/users/:id` | Có | Xem thông tin User bằng ID |
| `PATCH` | `/users/:id` | Có | Thay đổi thông tin cá nhân |
| `DELETE` | `/users/:id` | Admin | Đóng tài khoản (Lock) |

### Giao Nhận Địa Chỉ

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `GET` | `/addresses` | Có | Xem hòm địa chỉ cá nhân |
| `POST` | `/addresses` | Có | Thêm vị trí mới |
| `PATCH` | `/addresses/:id` | Có | Thay đổi vị trí gửi |
| `DELETE` | `/addresses/:id` | Có | Huỷ địa chỉ |
| `PATCH` | `/addresses/:id/default` | Có | Thiết lập làm Default Routing |

### Quản Lý Sản Phẩm

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `GET` | `/products` | Không | Danh sách mặt hàng (Tự động lọc) |
| `GET` | `/products/:id` | Không | Trích thông tin sản phẩm bằng DB UUID |
| `GET` | `/products/slug/:slug` | Không | Tìm bằng URL Slug Website |
| `POST` | `/products` | Admin | Khởi tạo Data (Sản phẩm trống) |
| `PATCH` | `/products/:id` | Admin | Ghi đè chỉ số cấu hình nội bộ sản phẩm |
| `DELETE` | `/products/:id` | Admin | Xóa mặt hàng |
| `POST` | `/products/admin` | Admin | Thêm sản phẩm cùng tải file hình Multipart |
| `PUT` | `/products/admin/:id` | Admin | Update nội dung đính kèm Update File mới |
| `DELETE` | `/products/admin/:id` | Admin | Tắt sản phẩm thu hẹp Minio |

### Phân Loại Mặt Hàng (Category)

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `GET` | `/categories` | Không | List toàn bộ Danh mục |
| `GET` | `/categories/:id` | Không | Liệt kê category ID |
| `POST` | `/categories` | Admin | Tạo Node phân chuyên |
| `PATCH` | `/categories/:id` | Admin | Update Root danh mục |
| `DELETE` | `/categories/:id` | Admin | Giải phóng danh sách category |

### Giỏ Yêu Cầu (Cart)

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `GET` | `/cart` | Có | Lấy chi tiết thông tin Cart Session |
| `POST` | `/cart/items` | Có | Nhồi sản phẩm chọn vào danh sách |
| `PATCH` | `/cart/items/:id` | Có | Tăng giảm lượng hàng |
| `DELETE` | `/cart/items/:id` | Có | Huỷ lệnh món |
| `DELETE` | `/cart` | Có | Trút danh sách làm mới lại |
| `POST` | `/cart/merge` | Có | Update Guest giỏ hàng với thông tin đã đăng nhập |

### Gói Đặt Hàng (Order)

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `POST` | `/orders` | Có | Xuất Invoice giỏ hàng để thành Orders |
| `GET` | `/orders` | Có | Theo dõi các chuyến hàng User |
| `GET` | `/orders/:id` | Có | List mã chứng nhận Code chi tiết |
| `PATCH` | `/orders/:id/status` | Admin | Gán trạng thái (Đã nhận - Shipping) |
| `POST` | `/orders/:id/cancel` | Có | Huỷ lệnh gọi |
| `GET` | `/orders/all` | Admin | Panel Danh sách Tracking Admin |

### Tài Khoản Ví (Payments)

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `POST` | `/payments/process` | Có | Lệnh phát động thanh khoản mã COD / Ngân Hàng |
| `GET` | `/payments/:id` | Có | Truy vấn thông lượng |
| `GET` | `/payments/order/:orderId` | Có | Đính kèm hóa đơn đối ứng hóa đơn Order |
| `POST` | `/payments/webhook/sepay` | Không | Điểm nối nhận phản hồi Call-hook Server ngân hàng |
| `POST` | `/payments/confirm-cod` | Admin | Xác thực nhận giao tiền mặt Cash on Delivery |

### Khảo Sát Tăng Cường (AR)

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `POST` | `/ar/snapshots` | Có | In và Lưu trữ định hình Render View Mode |
| `GET` | `/ar/snapshots` | Có | Cấp phát Model Json dữ liệu VR view |

### Báo Cáo Thống Kê (Report)

| Method | Endpoint | Xác Thực | Mô Tả |
|:-------|:---------|:-----|:------------|
| `GET` | `/reports/sales-summary` | Admin | Chỉ số Doanh Thu / Khấu hao |
| `GET` | `/reports/product-performance` | Admin | Biểu đồ Hot/Cold Items (Mặt hàng Hot) |
| `GET` | `/reports/user-cohort` | Admin | Hệ khảo sát tệp tương tác truy cập |

### Kênh Y Tế Định Dạng Kiểm Định Của Bot Node (Health Checks)

| Method | Endpoint | Mô Tả |
|:-------|:---------|:------------|
| `GET` | `/health` | Kiểm tra TCP Socket qua NATS |
| `GET` | `/health/ready` | Check In readiness của Docker/Kubernetes network |
| `GET` | `/health/live` | Báo nhịp ping live uptime |
| `GET` | `/health/services` | Load Detail báo cáo hoạt động 8 container |

> Lưu ý: Source code dự phòng **Postman Collection** tham chiếu ở tại file `postman-collection.json` tích hợp trọn gói định dạng Endpoint truyền gởi thông số Payload/Params.

---

## Mô Hình Dữ Liệu

Tất cả service chứa tệp khai báo độc lập sử dụng Database PostgreSQL riêng. Dưới đây là phân tích luồng các bảng trong model DB:

### User Service (`user_db` — port 5433)

```text
User
├── id          String   @id (CUID)
├── email       String   @unique
├── passwordHash String
├── fullName    String
├── phone       String?
├── role        UserRole (ADMIN | CUSTOMER)
├── isActive    Boolean
├── addresses   Address[]
└── timestamps

Address
├── id, userId, fullName, phone
├── street, ward, district, city
└── isDefault   Boolean
```

### Product Service (`product_db` — port 5434)

```text
Product
├── id, sku (unique), name, slug (unique)
├── priceInt    Int
├── stock       Int
├── description String?
├── imageUrls   String[]   (Lịch sử thay thế)
├── imageUrl    String?    (MinIO file location)
├── categoryId  String?
├── attributes  Json?
├── model3dUrl  String?    (AR View file)
└── timestamps

Category (self-referencing tree)
├── id, name, slug (unique)
├── parentId → Category?
├── children → Category[]
└── products → Product[]
```

### Order Service (`order_db` — port 5436)

```text
Order
├── id, userId, addressId?
├── status        OrderStatus (PENDING → PROCESSING → SHIPPED → DELIVERED | CANCELLED)
├── paymentStatus PaymentStatus (UNPAID | PAID)
├── totalInt      Int
└── items         OrderItem[]

OrderItem
├── productId, productName (snapshot), imageUrls (snapshot)
├── quantity, priceInt
└── orderId → Order
```

### Payment Service (`payment_db` — port 5437)

```text
Payment
├── id, orderId
├── method    PaymentMethod (COD | SEPAY)
├── amountInt Int
├── status    PaymentStatus (UNPAID | PAID)
└── payload   Json?

Transaction (SePay webhook data)
├── sePayId (unique), gateway
├── transactionDate, accountNumber
├── amountIn, amountOut, accumulated
├── code, transactionContent, referenceCode
└── indexed by sePayId and transactionDate
```

### Cart Service (`cart_db` — port 5435)

```text
Cart
├── id, sessionId (unique), userId?
└── items → CartItem[]

CartItem  @@unique([cartId, productId])
├── cartId → Cart (cascade delete)
├── productId, quantity
```

### AR Service (`ar_db` — port 5438)

```text
ARSnapshot
├── id, userId?, productId
├── imageUrl, metadata (Json?)
```

### Report Service (`report_db` — port 5439)

```text
ReportEntry
├── id, type
├── payload (Json?), fromAt, toAt
```

---

## Cấu Hình

### Biến Số Hệ Thống

Kiểm tra tại mục `.env.example` -> sao chép lưu định dạng ra file `.env`

```bash
cp .env.example .env
```

| Tên Biến Mặc Định | Mô tả Cấu Trúc Khai Báo |
|:---------|:------------|
| `PORT` | Cổng Public Gateway HTTP (`3000`) |
| `NODE_ENV` | `development` / `production` |
| `NATS_URL` | Socket Gateway truyền mạng TCP NATS (`nats://localhost:4222`) |
| `CORS_ORIGIN` | Allowed domains truy cập phân đoạn `*` (`http://locahost:...`) |
| `JWT_ALGORITHM` | Mode mã hóa Token (`RS256`) |
| `JWT_EXPIRES_IN` | Thời gian hạn sống Access-Token (`15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Hạn Token Refresh tái tạo Session (`7d`) |
| `LOG_LEVEL` | Chế độ Dump debug Console Output (`info`, `debug`) |
| `DATABASE_URL_*` | Domain Server PostgreSQL nội bộ cấu hình liên kết Port DB |
| `SEPAY_ACCOUNT_NUMBER` | (*Bắt BUỘC*) Mã account Virtual Sepay liên kết ngân hàng |
| `SEPAY_BANK_NAME` | Ngân hàng (Ví dụ: `BIDV`) dùng cho QR |
| `ACCOUNT_NAME` | (*Bắt Buộc*) Tên hiển thị người sỡ hữu / Shop trên Bill giao thức Webhook |

### RSA Key Pair

Lưu trữ bộ key private/public tại thư mục `/keys/` sau khi thực hiện script `pnpm run generate:keys` (Thư mục không xuất lên Git để bảo vệ Secret). Lên Server thật cần sử dụng AWS Secret Key hay Docker Secret.

### Các Cổng Cập Cảng Server (Port Configuration)

| Tên Định Tuyến | Cổng | Master Auth Password |
|:--------|:-----|:------------|
| **API Gateway** | `3000` | N/A |
| **NATS** | `4222` (client), `8222` (Giám định console) | N/A |
| **MinIO** | `9000` (API), `9001` (Dashboard) | `minio` / `supersecret` |
| **user_db** | `5433` | `user` / `user_password` |
| **product_db** | `5434` | `product` / `product_password` |
| **cart_db** | `5435` | `cart` / `cart_password` |
| **order_db** | `5436` | `order` / `order_password` |
| **payment_db** | `5437` | `payment` / `payment_password` |
| **ar_db** | `5438` | `ar` / `ar_password` |
| **report_db** | `5439` | `report` / `report_password` |

---

## Kiểm Thử

### Component Testing (Unit Test)

```bash
pnpm test               # Run check định danh
pnpm test:watch          # Code check Runtime lưu
pnpm test:cov            # Report thống kê Coverage Report
```

### Server Flow Test (E2E Tests)

Khởi chạy bằng cách thiết lập Container DB kiểm thử sử dụng Node docker compose test chuyên biệt:

```bash
# Workflow Auto toàn bộ luồng pipeline E2E
pnpm test:full

# Testing thao tác tự quản lí 
pnpm test:compose:up      # Start Docker Testing Servers
pnpm test:compose:wait    # Ping TCP Connection kết nối
pnpm test:db:push         # Inject Table / Reset 
pnpm test:run             # Start Jest
pnpm test:compose:down    # Dọn dẹp đóng băng Node DB test
```

---

## Docker & Triển Khai

### Môi trường Build Local (Docker Compose)

```bash
# Phóng Container Database, Minio, NATS Server background
docker compose up -d

# Xem xét tình trạng file log Output 
docker compose logs -f

# Tắt tiến trình, loại bỏ config Volume Network
docker compose down -v
```

### Môi trường Production Build Output Cốt Lõi

File Base Root Dockerfile thiết lập tại thư mục `docker/`:

```bash
# Command tạo image cho tất cả Service nội hàm
export DOCKER_USERNAME=yourusername
export VERSION=v1.0.0
./scripts/build-all-images.sh

# Gửi Data lên Docker Cloud
./scripts/push-all-images.sh
```

### Trình Vận Biến Container Server - LƯU Ý TRỌNG ĐIỂM

```text
1. Bắt đầu toàn bộ hệ Server CSDL Database PostgreSQL.
2. Bật kết nối Server cổng ngõ Core NATS.
3. Kích chạy Service `user-app` (Sẽ khởi tạo mã Key JWT sau 60 giây delay load base).
4. Khởi chạy Gateway API  (Đọc mã JSON Public Key từ hệ NATS sau 30s check in delay request).
5. Load Toàn hệ System Microservices Component cuối.
```

> Cảnh cáo hệ thống: **Nếu `user-app` không chạy, API Gateway không nhận diện Code cấp chứng nhận Token và sẽ báo ngắt lỗi mạng cục bộ với Status Timeout trên mọi lệnh xác thực Auth.**

### Cấp Phép Lên Sub-Domain (Host)

```bash
cd deploys/
cp .env.example .env
# Edit credentials config trong .env mới

./deploy.sh gateway       # Run target cổng mạng 1
./deploy.sh user-app      # Phân vùng Load balancer mạng 2
./deploy.sh product-app   # Instance mạng số 3
```

Thao tác tại Reference: `QUICK_START.md` và `DOCKER_HUB_SETUP.md`.

---

## Luồng CI/CD

Triển khai cấu trúc YAML GitHub Actions 2 chu kỳ:

### Chu kỳ 1 — Automation Build Unit

Start tại lệnh Trigger push trên branch `main` / `develop`

| Thông Lượng | Độ Tính | Chức Trách Hoạt Động |
|:-----|:---------|:--------|
| Valid định dạng Docker | Dưới 2 phút | Hadolint linter code script |
| Build đóng gói Image (x8) | 5 - 10 Phút | Build Instance Thread đa nhiệm |
| Tool Quét Lỗi (x8) | 3 Phút / 1 container | Dò xét các lỗi System bằng trình quét Trivy |
| Phân Mảng Hệ Test | 3-5 Phút | Gateway and Core Testing ping Start |
| Xuất log Output | Báo thông số | Render lên cửa sổ View Github Actions |

### Chu Kỳ 2 — Publish Docker Repo

Ghi dán TAG phát hành (`v*.*.*`) vào commit trigger branch `main`

- Tái sử dụng Layer Local Caching. 
- Xuất lệnh đẩy Images Push.
- Phát hành Auto Generator Release Note trên kho quản lí Repository Server Github.

Phần set environment `DOCKER_USERNAME` / `DOCKER_PASSWORD` làm tại Reference: `CI_CD_SETUP.md`.

---

## Tiêu Chuẩn Lập Trình

### Quản Chế Quy Code Template Định Khung (Formatting / Linter)

- Đảm bảo Format bằng **Prettier** thiết lập cấu hình cơ bản không thay mã config code convention.
- Chế độ Check IDE **ESLint** hỗ trợ fix tự động trên TypeScript.

```bash
pnpm format           # Force thay định dạng code Format All
pnpm format:check     # Chỉ phát hiện lỗi format 
pnpm lint             # Sửa lỗi Lint System Code Structure
pnpm lint:check       # Quét cảnh báo Lint rule
```

### Quy Định Về Code Module

- **Quy tắt Path Module**: File cấu hình Kebab-case (`categories.controller.ts`), Class Export Module PascalCase (`CategoriesController`).
- **Khởi chạy Message Event Broker**: Sử dụng Import const tại `libs/shared/events.ts`.
- **Dữ liệu Types, Response Data**: Code Response Model gom tập trung bên `libs/shared/`.

### Check list Thực Nghiệm Workflow Database 

```bash
# Push Cấu Trúc Script đến Schema Model Type App Code
pnpm db:gen:all

# Xuất cập nhật Table System tạm lên Postgres
pnpm db:push:all

# Export chu kỳ version Backup Schema Table DB Sql File
pnpm db:migrate:all

# Force format làm lại Node Local Postgres Table
pnpm db:reset:all

# Thiết Trình App View Model quản trị DB Web base UI (User App demo)
npx prisma studio --schema=apps/user-app/prisma/schema.prisma
```

---

## Khắc Phục Sự Cố

### Vướng Lỗi Tắt Port Đang Chạy Server Local (Conflict TCP)

```bash
# Check port đang dùng TCP 
lsof -i :5433          # Tại macOS/Linux CLI
netstat -ano | findstr :5433   # Hệ CMD Windows

# Reset Docker
docker compose down -v
```

### Lỗi DB Không Tạo Code Migrations Access

```bash
# Ping Container Output DB
docker compose ps

# Logs Log System Container Component
docker compose logs user_db

# Thử Reset Types
pnpm db:gen:all
```

### Khóa Cấu Trúc NATS Bị Crash TimeOut Socket

```bash
# Test Server View UI
curl http://localhost:8222/varz

# Monitor Connections
curl http://localhost:8222/connz

# Update Logs Monitor Event Topic Sub/Pun
curl http://localhost:8222/subsz

# Restart Component
docker compose restart nats
```

### Mất Chứng Nhận Access Code Token JWT Header / Auth Bị Lỗi

| Dấu Hiệu Lỗi Console | Do Môi Trường Load | Fix Resolve System |
|:--------|:------|:----|
| `"Service request timeout"` endpoint Authorization Router Header | App Node Gateway không định kiến lấy mã Code chứng nhận Token Public Key | Reset start node `user-app` chờ cho kết nối sau đó chạy Router `gateway` Node Client |
| `"Unauthorized"` | Token Server Refresh bị giới hạn khung hiệu lực | Auto Router Frontend bắt mã lấy /Refresh cấp mới Access Code |
| `"Token verification failed"` | Private Key RSA Generate Fail | Chạy Update Lại System CMD `pnpm run generate:keys` -> Restart Hệ System Mạng Docker Node Server Code |

---

## Đóng Góp

1. Click nút Fork
2. Checkout Code tới node tên `git checkout -b feature-component/update-module`
3. Phát triển đúng quy chế Commit code và Formatting Code Rules.
4. Lệnh chạy Auto Format Rules trước khi Branch Merge Request Push Node
   ```bash
   pnpm format:check
   pnpm lint:check
   pnpm test
   ```
5. Commit đúng định thức Conventional: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, hoặc `chore:`
6. Push PR code node `main`.

---

## Repository Liên Quan

| Repository | Mô Tả |
|:-----------|:-------|
| [Microservices-E-commerce-frontend](https://github.com/HaoNgo232/Microservices-E-commerce-frontend) | Giao diện cửa hàng và bảng quản trị (Next.js, React, TanStack Query) |

## Tài Liệu Khác

| Các Liên kết File Docs | Tóm Lược Chức Trách |
|:---------|:------------|
| [SETUP.md](./SETUP.md) | File quy trúc Setup và Map API Call Schema System NATS Component Architecture |
| [QUICK_START.md](./QUICK_START.md) | Deploy Script System Docker Production Code Workflow |
| [CI_CD_SETUP.md](./CI_CD_SETUP.md) | Định tuyến Action Pipeline Component Github |
| [DOCKER_HUB_SETUP.md](./DOCKER_HUB_SETUP.md) | Update Server Registry Docker Repository System |
| [postman-collection.json](./postman-collection.json) | File Raw Setup Environment URL Schema Params Variables Body Config Data |

---

<p align="center">
  Phát triển với <a href="https://nestjs.com/">NestJS</a> • <a href="https://nats.io/">NATS</a> • <a href="https://www.prisma.io/">Prisma</a> • <a href="https://www.postgresql.org/">PostgreSQL</a><br>
  MIT &copy; HaoNgo232
</p>
