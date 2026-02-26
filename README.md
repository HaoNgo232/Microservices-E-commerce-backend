<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="NestJS Logo" />
</p>

<h1 align="center">E-Commerce Microservices Platform</h1>

<p align="center">
  <em><strong>English</strong> | <a href="./docs/README.vi.md">Tiếng Việt</a></em>
</p>

<p align="center">
  A distributed e-commerce backend built with <strong>NestJS</strong>, <strong>NATS</strong>, <strong>Prisma</strong>, and <strong>PostgreSQL</strong> — following the microservices architecture pattern.
</p>

<p align="center">
  Part of the <strong>E-Commerce Microservices Platform</strong>. See also: <a href="https://github.com/HaoNgo232/Microservices-E-commerce-frontend">Frontend Repository</a>
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

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Configuration](#configuration)
- [Testing](#testing)
- [Docker & Deployment](#docker--deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Development Guidelines](#development-guidelines)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Project Overview

This platform is an e-commerce backend built with a microservices architecture for a graduation thesis project. It includes the following domains:

- **User Management** — Registration, authentication (RSA-based JWT), role-based access control (RBAC)
- **Product Catalog** — Products with categories, image uploads (MinIO), slug-based routing, and 3D model support
- **Shopping Cart** — Session-based carts with user merge support on login
- **Order Processing** — Full order lifecycle from creation to delivery with status tracking
- **Payment Integration** — COD and SePay bank transfer with webhook-driven payment verification
- **AR (Augmented Reality)** — Product snapshot storage for virtual try-on features
- **Reporting** — Sales summaries, product performance, and user cohort analytics

Each domain runs as an independent microservice with its own PostgreSQL database, communicating through the NATS message broker.

---

## Architecture

### High-Level Overview

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

### Security Model — Perimeter Security

The system implements a Perimeter Security pattern:

| Layer | Responsibility |
|:------|:---------------|
| **API Gateway** | Authenticates every inbound HTTP request via `AuthGuard` (JWT verification) |
| **Middleware Stack** | `AuditLogMiddleware` → `RateLimitMiddleware` (100 req/min per IP) |
| **NATS (Internal)** | Microservices trust messages received via the broker — no per-service auth guards |
| **JWT Strategy** | RSA-256 asymmetric encryption — user-app signs tokens with a private key; gateway verifies with the public key, received at startup via NATS |

### Key Design Patterns

- **API Gateway Pattern** — Single entry point with centralized cross-cutting concerns
- **Database-per-Service** — Each microservice owns its data store; no cross-database joins
- **Template Method** — `BaseGatewayController` provides a unified NATS communication layer with timeout/retry/error handling
- **Message Queue Groups** — NATS queue groups (`queue: 'service-name'`) for load balancing across service instances
- **Event-Driven Communication** — NATS subjects with request/reply and fire-and-forget patterns

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Framework** | NestJS 11 | Backend framework |
| **Language** | TypeScript 5.7 | Type safety |
| **Message Broker** | NATS 2.10 | Inter-service communication |
| **ORM** | Prisma 6 | Database access and migrations |
| **Database** | PostgreSQL 16 | Relational data storage |
| **Object Storage** | MinIO | S3-compatible storage |
| **Auth** | jose + @nestjs/jwt | RSA-256 JWT signing and verification |
| **Validation** | class-validator + class-transformer | DTO validation |
| **Password Hashing** | bcryptjs | Password storage |
| **Testing** | Jest 30 + Supertest | Unit and E2E testing |
| **Linting** | ESLint 9 + Prettier | Code formatting |
| **Package Manager** | pnpm 10 | Dependency management |
| **Containerization** | Docker + Docker Compose | Service orchestration |
| **CI/CD** | GitHub Actions | Automated build, test, and push |
| **Health Checks** | @nestjs/terminus | Kubernetes-compatible health probes |

---

## Project Structure

This is a NestJS monorepo managed via `nest-cli.json` with 8 applications and 1 shared library:

```
Microservices-E-commerce-backend
├── apps/                          # All applications
│   ├── gateway/                   # API Gateway (HTTP → NATS)
│   │   └── src/
│   │       ├── main.ts               # Express HTTP server bootstrap
│   │       ├── app.module.ts         # Root module with middleware configuration
│   │       ├── base.controller.ts    # Abstract controller with NATS communication
│   │       ├── gateway-clients.module.ts  # Global NATS client proxy registration
│   │       ├── key-receiver.service.ts    # Receives JWT public key from user-app
│   │       ├── health.controller.ts  # Health & readiness endpoints
│   │       ├── auth/                 # Auth controller, guards, decorators
│   │       ├── users/                # User CRUD proxy
│   │       ├── addresses/            # Address management proxy
│   │       ├── products/             # Product + Category proxy
│   │       ├── cart/                 # Cart proxy
│   │       ├── orders/               # Order proxy
│   │       ├── payments/             # Payment proxy + webhook
│   │       ├── ar/                   # AR snapshot proxy
│   │       ├── middleware/           # RateLimitMiddleware, AuditLogMiddleware
│   │       └── filters/              # HttpExceptionFilter
│   │
│   ├── user-app/                  # User Microservice
│   │   ├── prisma/schema.prisma      # User + Address models
│   │   └── src/
│   │       ├── auth/                 # Registration, login, JWT signing
│   │       ├── users/                # User CRUD operations
│   │       └── address/              # Address management
│   │
│   ├── product-app/              # Product Microservice
│   │   ├── prisma/schema.prisma      # Product + Category models
│   │   └── src/
│   │       ├── products/             # Product CRUD + stock management
│   │       ├── categories/           # Category tree management
│   │       └── minio/                # MinIO image upload/delete
│   │
│   ├── cart-app/                  # Cart Microservice
│   │   ├── prisma/schema.prisma      # Cart + CartItem models
│   │   └── src/                      # Cart CRUD, merge on login
│   │
│   ├── order-app/                 # Order Microservice
│   │   ├── prisma/schema.prisma      # Order + OrderItem models
│   │   └── src/                      # Order lifecycle management
│   │
│   ├── payment-app/              # Payment Microservice
│   │   ├── prisma/schema.prisma      # Payment + Transaction models
│   │   └── src/                      # COD + SePay integration
│   │
│   ├── ar-app/                    # AR Microservice
│   │   ├── prisma/schema.prisma      # ARSnapshot model
│   │   └── src/                      # AR snapshot management
│   │
│   └── report-app/               # Reporting Microservice
│       ├── prisma/schema.prisma      # ReportEntry model
│       └── src/                      # Sales, product, user analytics
│
├── libs/
│   └── shared/                    # Shared library (@shared/*)
│       ├── main.ts                   # Barrel exports
│       ├── events.ts                 # NATS event pattern constants
│       ├── config/                   # Environment configuration
│       ├── dto/                      # Shared DTOs (auth, user, product, etc.)
│       ├── types/                    # Response type interfaces
│       ├── filters/                  # RPC exception filter
│       ├── exceptions/               # Custom RPC exceptions
│       ├── jwt/                      # JWT module & service
│       ├── utils/                    # NatsPayload helper, retry, etc.
│       └── testing/                  # RPC test helpers
│
├── docker/                        # Dockerfiles per service
│   ├── gateway/Dockerfile
│   └── microservices/*/Dockerfile
│
├── deploys/                       # Per-service docker-compose files
├── scripts/                       # Build, push, seed, migration scripts
├── docs/                          # Additional documentation
│
├── docker-compose.yml                # Dev infrastructure
├── docker-compose.test.yml           # Test infrastructure
├── nest-cli.json                     # NestJS monorepo configuration
├── package.json                      # Root dependencies and scripts
├── jest.config.js                    # Jest configuration
├── eslint.config.mjs                 # ESLint flat config
├── .prettierrc                       # Prettier configuration
└── .env.example                      # Environment variable reference
```

---

## Getting Started

### Prerequisites

| Tool | Version | Installation |
|:-----|:--------|:-------------|
| **Node.js** | v20+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | v10+ | `npm install -g pnpm` |
| **Docker** | v24+ | [docker.com](https://www.docker.com/) |
| **Docker Compose** | v2+ | Included with Docker Desktop |

### Step 1 — Clone & Install

```bash
git clone https://github.com/HaoNgo232/Microservices-E-commerce-backend.git
cd Microservices-E-commerce-backend
pnpm install
```

### Step 2 — Configure Environment

```bash
cp .env.example .env
```

Review and update `.env` as needed.

### Step 3 — Generate RSA Keys

The JWT system requires an RSA key pair. The user-app signs tokens with the private key, and the gateway verifies using the public key.

```bash
pnpm run generate:keys
```

### Step 4 — Start Infrastructure

```bash
# Start NATS, PostgreSQL databases (×7), and MinIO
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

### Step 5 — Initialize Databases

```bash
# Generate Prisma clients for all services
pnpm run db:gen:all

# Run database migrations
pnpm run db:migrate:all
```

### Step 6 — Start All Services

```bash
# Development mode with hot-reload for all 8 services
pnpm run dev:all
```

Or start services individually:

```bash
pnpm nest start --watch gateway
pnpm nest start --watch user-app
pnpm nest start --watch product-app
```

### Step 7 — Verify

```bash
# Gateway health check
curl http://localhost:3000/health

# Check all microservice connectivity
curl http://localhost:3000/health/services
```

---

## API Reference

All endpoints are exposed through the API Gateway at `http://localhost:3000`.

### Authentication

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `POST` | `/auth/register` | No | Register a new user account |
| `POST` | `/auth/login` | No | Login and receive JWT tokens |
| `POST` | `/auth/refresh` | No | Refresh an expired access token |
| `POST` | `/auth/verify` | No | Verify a JWT token's validity |
| `GET` | `/auth/me` | Yes | Get current authenticated user |

### Users

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/users` | Admin | List all users |
| `GET` | `/users/:id` | Yes | Get user by ID |
| `PATCH` | `/users/:id` | Yes | Update user profile |
| `DELETE` | `/users/:id` | Admin | Deactivate a user |

### Addresses

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/addresses` | Yes | List user's addresses |
| `POST` | `/addresses` | Yes | Create a new address |
| `PATCH` | `/addresses/:id` | Yes | Update an address |
| `DELETE` | `/addresses/:id` | Yes | Delete an address |
| `PATCH` | `/addresses/:id/default` | Yes | Set as default address |

### Products

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/products` | No | List products (paginated, filterable) |
| `GET` | `/products/:id` | No | Get product by ID |
| `GET` | `/products/slug/:slug` | No | Get product by URL slug |
| `POST` | `/products` | Admin | Create product |
| `PATCH` | `/products/:id` | Admin | Update product |
| `DELETE` | `/products/:id` | Admin | Delete product |
| `POST` | `/products/admin` | Admin | Create product with image upload |
| `PUT` | `/products/admin/:id` | Admin | Update product with image upload |
| `DELETE` | `/products/admin/:id` | Admin | Delete product and associated images |

### Categories

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/categories` | No | List all categories |
| `GET` | `/categories/:id` | No | Get category by ID |
| `POST` | `/categories` | Admin | Create category |
| `PATCH` | `/categories/:id` | Admin | Update category |
| `DELETE` | `/categories/:id` | Admin | Delete category |

### Cart

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/cart` | Yes | Get current user's cart |
| `POST` | `/cart/items` | Yes | Add item to cart |
| `PATCH` | `/cart/items/:id` | Yes | Update item quantity |
| `DELETE` | `/cart/items/:id` | Yes | Remove item from cart |
| `DELETE` | `/cart` | Yes | Clear entire cart |
| `POST` | `/cart/merge` | Yes | Merge guest cart into user cart |

### Orders

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `POST` | `/orders` | Yes | Create order from cart |
| `GET` | `/orders` | Yes | List user's orders |
| `GET` | `/orders/:id` | Yes | Get order details |
| `PATCH` | `/orders/:id/status` | Admin | Update order status |
| `POST` | `/orders/:id/cancel` | Yes | Cancel an order |
| `GET` | `/orders/all` | Admin | List all orders (admin) |

### Payments

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `POST` | `/payments/process` | Yes | Initiate payment (COD / SePay QR) |
| `GET` | `/payments/:id` | Yes | Get payment by ID |
| `GET` | `/payments/order/:orderId` | Yes | Get payment by order ID |
| `POST` | `/payments/webhook/sepay` | No | SePay webhook callback |
| `POST` | `/payments/confirm-cod` | Admin | Confirm COD payment received |

### AR (Augmented Reality)

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `POST` | `/ar/snapshots` | Yes | Create AR try-on snapshot |
| `GET` | `/ar/snapshots` | Yes | List user's AR snapshots |

### Reports

| Method | Endpoint | Auth | Description |
|:-------|:---------|:-----|:------------|
| `GET` | `/reports/sales-summary` | Admin | Sales summary statistics |
| `GET` | `/reports/product-performance` | Admin | Product performance metrics |
| `GET` | `/reports/user-cohort` | Admin | User cohort analysis |

### Health Checks

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/health` | NATS connectivity check |
| `GET` | `/health/ready` | Kubernetes readiness probe |
| `GET` | `/health/live` | Kubernetes liveness probe |
| `GET` | `/health/services` | Detailed health of all microservices |

### Usage Examples

**Register a user:**

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "fullName": "John Doe"
  }'
```

**Login and use the token:**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "SecurePass123!"}' \
  | jq -r '.accessToken')

# Access protected endpoint
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Browse products with filters:**

```bash
curl "http://localhost:3000/products?page=1&pageSize=10&search=glasses&categorySlug=eyewear"
```

> Note: A raw Postman Collection is available at [`postman-collection.json`](./postman-collection.json) for exploring endpoints.

---

## Data Models

Each microservice maintains its own dedicated PostgreSQL database. Below is a summary of the core schemas:

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
├── imageUrls   String[]   (legacy)
├── imageUrl    String?    (MinIO URL)
├── categoryId  String?
├── attributes  Json?
├── model3dUrl  String?    (AR 3D model)
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

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|:---------|:--------|:------------|
| `PORT` | `3000` | Gateway HTTP port |
| `NODE_ENV` | `development` | Application environment |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `CORS_ORIGIN` | `*` | Comma-separated allowed origins |
| `JWT_ALGORITHM` | `RS256` | JWT signing algorithm |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `DATABASE_URL_USER` | `postgresql://user:user_password@localhost:5433/user_db` | User service DB |
| `DATABASE_URL_PRODUCT` | `postgresql://product:product_password@localhost:5434/product_db` | Product service DB |
| `DATABASE_URL_CART` | `postgresql://cart:cart_password@localhost:5435/cart_db` | Cart service DB |
| `DATABASE_URL_ORDER` | `postgresql://order:order_password@localhost:5436/order_db` | Order service DB |
| `DATABASE_URL_PAYMENT` | `postgresql://payment:payment_password@localhost:5437/payment_db` | Payment service DB |
| `DATABASE_URL_AR` | `postgresql://ar:ar_password@localhost:5438/ar_db` | AR service DB |
| `DATABASE_URL_REPORT` | `postgresql://report:report_password@localhost:5439/report_db` | Report service DB |
| `SEPAY_ACCOUNT_NUMBER` | *(required for payments)* | SePay virtual account number |
| `SEPAY_BANK_NAME` | `BIDV` | Bank name for SePay QR |
| `ACCOUNT_NAME` | *(required for payments)* | Display name on payment QR code |

### RSA Key Pair

Generated via `pnpm run generate:keys` — stored in the `keys/` directory (ignored by version control). In a production environment, provide keys via environment variables or a secrets managing service.

### Infrastructure Ports

| Service | Port | Credentials |
|:--------|:-----|:------------|
| **API Gateway** | `3000` | — |
| **NATS** | `4222` (client), `8222` (monitor) | — |
| **MinIO** | `9000` (API), `9001` (console) | `minio` / `supersecret` |
| **user_db** | `5433` | `user` / `user_password` |
| **product_db** | `5434` | `product` / `product_password` |
| **cart_db** | `5435` | `cart` / `cart_password` |
| **order_db** | `5436` | `order` / `order_password` |
| **payment_db** | `5437` | `payment` / `payment_password` |
| **ar_db** | `5438` | `ar` / `ar_password` |
| **report_db** | `5439` | `report` / `report_password` |

---

## Testing

### Unit Tests

```bash
pnpm test               # Run all unit tests
pnpm test:watch          # Watch mode
pnpm test:cov            # With coverage report
```

### E2E Tests

E2E tests use Docker Compose to set up isolated test databases:

```bash
# Full automated E2E testing
pnpm test:full

# Or step-by-step testing
pnpm test:compose:up      # Start test databases
pnpm test:compose:wait    # Wait for DBs to be ready
pnpm test:db:push         # Push schema to test DBs
pnpm test:run             # Execute E2E tests
pnpm test:compose:down    # Tear down test containers
```

---

## Docker & Deployment

### Development (Docker Compose)

```bash
# Start all infrastructure
docker compose up -d

# View logs
docker compose logs -f

# Clean up containers
docker compose down -v
```

### Production Build

Each service relies on its own Dockerfile in `docker/`:

```bash
# Build all Docker images
export DOCKER_USERNAME=yourusername
export VERSION=v1.0.0
./scripts/build-all-images.sh

# Push to Docker Hub
./scripts/push-all-images.sh
```

### Critical Startup Order

```text
1. PostgreSQL databases
2. NATS server
3. user-app (signs and broadcasts JWT public key — wait ~60s)
4. gateway  (receives public key from user-app — wait ~30s)
5. All other microservices (any order)
```

> Warning: **If user-app starts after gateway**, the gateway won't receive the JWT public key, leading to authentication timeouts.

### Deployment Process

```bash
cd deploys/
cp .env.example .env
# Edit .env fields here

./deploy.sh gateway       # Target Host 1
./deploy.sh user-app      # Target Host 2
./deploy.sh product-app   # Target Host 3
```

Refer to `QUICK_START.md` for Docker deployment guidelines and `DOCKER_HUB_SETUP.md` for registry configuration.

---

## CI/CD Pipeline

The project uses GitHub Actions across two distinct workflows:

### Workflow 1 — Build & Test

Triggered by pushes or pull requests to the `main` or `develop` branches.

| Step | Duration | Details |
|:-----|:---------|:--------|
| Lint Dockerfiles | ~2 min | Validation with Hadolint |
| Build Images (×8) | ~5–10 min | Parallel Docker builds |
| Security Scan (×8) | ~2–3 min/img | Vulnerability scanning using Trivy |
| Test Containers | ~3–5 min | Service startup verification |
| Report | — | Job summary output |

### Workflow 2 — Release & Publishing

Triggered by pushes to `main` or upon creating version tags. Build steps utilize registry caching and push the final artifacts to Docker Hub.

---

## Development Guidelines

### Code Standards

- formatting is managed under the `.prettierrc` configuration.
- Linting checks are running via `eslint.config.mjs` against TypeScript code.

```bash
pnpm format           # Format code
pnpm format:check     # Check format
pnpm lint             # Apply linting fixes
pnpm lint:check       # Check lint rules
```

### Component Structure

- **Naming**: Use kebab-case for files (`auth.controller.ts`) and PascalCase for constructs (`AuthController`).
- **Events**: Reference NATS patterns centrally in `libs/shared/events.ts`.
- **Contracts**: DTOs and Response Types are globally accessible in `libs/shared/`.

### Database Lifecycle

```bash
# Rebuild Prisma schemas
pnpm db:gen:all

# Development schema updates
pnpm db:push:all

# Formal migration generation
pnpm db:migrate:all

# Reset process
pnpm db:reset:all

# Studio UI
npx prisma studio --schema=apps/user-app/prisma/schema.prisma
```

---

## Troubleshooting

### Port Conflicts

```bash
# Find port allocations
lsof -i :5433          # macOS/Linux
netstat -ano | findstr :5433   # Windows

# Clean up running dependencies
docker compose down -v
```

### Database Connection Errors

```bash
# Check running status
docker compose ps

# Container logs
docker compose logs user_db

# Rebuilding types if needed
pnpm db:gen:all
```

### NATS Connection Errors

```bash
# Server status
curl http://localhost:8222/varz

# Client connections
curl http://localhost:8222/connz

# Active subscriptions
curl http://localhost:8222/subsz

# Reboot broker
docker compose restart nats
```

### Authentication Errors

| Symptom | Cause | Solution |
|:--------|:------|:----|
| `"Service request timeout"` on auth | Missing public key | Start `user-app` correctly, then run `gateway` |
| `"Unauthorized"` | Expired token | Proceed to token refresh or re-login |
| `"Token verification failed"` | Missmatched keys | Execute `pnpm run generate:keys` and restart |

---

## Contributing

1. Fork the repository
2. Create your branch (`git checkout -b feature/name`)
3. Develop adhering to the [development guidelines](#development-guidelines)
4. Build and add necessary unit or integration tests
5. Run validations:
   ```bash
   pnpm format:check
   pnpm lint:check
   pnpm test
   ```
6. Commit changes using Conventional Commits
7. Format: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, or `chore:`
8. Submit a Pull Request.

---

## Related Repositories

| Repository | Description |
|:-----------|:------------|
| [Microservices-E-commerce-frontend](https://github.com/HaoNgo232/Microservices-E-commerce-frontend) | Storefront and admin dashboard (Next.js, React, TanStack Query) |

## Additional Documentation

| Document | Description |
|:---------|:------------|
| [SETUP.md](./docs/SETUP.md) | Setup and architecture details |
| [QUICK_START.md](./docs/QUICK_START.md) | Initial deployment instructions |
| [CI_CD_SETUP.md](./docs/CI_CD_SETUP.md) | Pipeline mechanics |
| [DOCKER_HUB_SETUP.md](./docs/DOCKER_HUB_SETUP.md) | Container registry integrations |
| [postman-collection.json](./postman-collection.json) | Full endpoint listing definitions |

---

<p align="center">
  Built with <a href="https://nestjs.com/">NestJS</a> • <a href="https://nats.io/">NATS</a> • <a href="https://www.prisma.io/">Prisma</a> • <a href="https://www.postgresql.org/">PostgreSQL</a>
</p>
