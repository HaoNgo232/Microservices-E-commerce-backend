# Docker Deployment với External Databases

## Mục tiêu

Build Docker images một lần, push lên Docker Hub, deploy lên các hosts bằng cách pull images. Microservices kết nối tới external PostgreSQL server(s). Dynamic JWT key distribution qua NATS.

## Deployment Architecture

```
Build Machine:
  Build 8 images → Push to Docker Hub

Database Server (1 host):
  PostgreSQL với 7 databases riêng
  (user_db, product_db, order_db, cart_db, payment_db, report_db, ar_db)

NATS Server (1 host):
  NATS message broker

App Hosts:
  Host 1: Gateway (HTTP + NATS)
  Host 2: User-app (NATS + connect DB)
  Host 3: Product-app (NATS + connect DB)
  ... 5 hosts khác
```

## Docker Images

- `<username>/lv-gateway:latest`
- `<username>/lv-user-app:latest`
- `<username>/lv-product-app:latest`
- `<username>/lv-order-app:latest`
- `<username>/lv-cart-app:latest`
- `<username>/lv-payment-app:latest`
- `<username>/lv-report-app:latest`
- `<username>/lv-ar-app:latest`

## JWT Keys (Tự động qua NATS)

**Flow:**

1. User-app startup → Generate keys → Publish public key qua NATS
2. Gateway startup → Subscribe NATS → Receive public key → Start HTTP
3. No manual file distribution needed

## Implementation Steps

### 1. Implement Dynamic Key Distribution

**User-app KeyDistributorService:**

- File: `apps/user-app/src/key-distributor.service.ts`
- Injectable, OnModuleInit
- Generate/load RSA key pair
- Publish public key to NATS subject `auth.public-key`
- Payload: `{ publicKey: string, algorithm: 'RS256', issuedAt: number }`

**Gateway KeyReceiverService:**

- File: `apps/gateway/src/key-receiver.service.ts`
- Injectable, OnModuleInit
- Subscribe `auth.public-key`
- Wait with timeout (30s) và retry logic
- Cache public key in memory

**Gateway AuthModule Update:**

- File: `apps/gateway/src/auth/auth.module.ts`
- JwtModule.registerAsync()
- Inject KeyReceiverService
- useFactory: async get public key từ receiver

### 2. Tạo Dockerfiles (Simple, no database)

**Gateway Dockerfile:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build gateway

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
CMD ["node", "dist/apps/gateway/main.js"]
```

**Microservices Dockerfile Template:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
ARG APP_NAME
RUN pnpm build ${APP_NAME}
RUN pnpm exec prisma generate --schema=apps/${APP_NAME}/prisma/schema.prisma

FROM node:20-alpine
WORKDIR /app
ARG APP_NAME
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/${APP_NAME}/prisma ./apps/${APP_NAME}/prisma
COPY --from=builder /app/package.json ./
COPY scripts/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV NODE_ENV=production
ENV APP_NAME=${APP_NAME}
ENTRYPOINT ["/entrypoint.sh"]
```

**7 Microservices Dockerfiles:**

- `Dockerfile.user-app` (APP_NAME=user-app)
- `Dockerfile.product-app` (APP_NAME=product-app)
- `Dockerfile.order-app` (APP_NAME=order-app)
- `Dockerfile.cart-app` (APP_NAME=cart-app)
- `Dockerfile.payment-app` (APP_NAME=payment-app)
- `Dockerfile.report-app` (APP_NAME=report-app)
- `Dockerfile.ar-app` (APP_NAME=ar-app)

### 3. Tạo Entrypoint Script

**File: `scripts/docker-entrypoint.sh`**

```bash
#!/bin/sh
set -e

APP_NAME=${APP_NAME:-"unknown"}
echo "Starting $APP_NAME..."

# Run migrations
if [ "$APP_NAME" != "unknown" ]; then
  echo "Running Prisma migrations for $APP_NAME..."
  npx prisma migrate deploy --schema=apps/${APP_NAME}/prisma/schema.prisma

  # Generate keys for user-app only
  if [ "$APP_NAME" = "user-app" ]; then
    echo "Generating JWT keys..."
    mkdir -p /app/keys
    node dist/scripts/generate-keys.js || true
  fi
fi

# Start application
echo "Starting application..."
node dist/apps/${APP_NAME}/main.js
```

### 4. Tạo Build & Push Scripts

**File: `scripts/build-all-images.sh`**

```bash
#!/bin/bash
set -e

REGISTRY_USER=${DOCKER_USERNAME:-"yourusername"}
VERSION=${VERSION:-"latest"}

echo " Building all Docker images..."
echo "Registry: $REGISTRY_USER"
echo "Version: $VERSION"
echo ""

# Build gateway (no APP_NAME needed)
echo " Building gateway..."
docker build -t $REGISTRY_USER/lv-gateway:$VERSION -f Dockerfile.gateway .

# Build microservices
apps=("user-app" "product-app" "order-app" "cart-app" "payment-app" "report-app" "ar-app")

for app in "${apps[@]}"; do
  echo " Building $app..."
  docker build \
    -t $REGISTRY_USER/lv-$app:$VERSION \
    -f Dockerfile.$app \
    --build-arg APP_NAME=$app \
    .
done

echo ""
echo " All images built successfully!"
docker images | grep lv-
```

**File: `scripts/push-all-images.sh`**

```bash
#!/bin/bash
set -e

REGISTRY_USER=${DOCKER_USERNAME:-"yourusername"}
VERSION=${VERSION:-"latest"}

echo " Pushing all images to Docker Hub..."
echo "Registry: $REGISTRY_USER"
echo "Version: $VERSION"
echo ""

all_apps=("gateway" "user-app" "product-app" "order-app" "cart-app" "payment-app" "report-app" "ar-app")

for app in "${all_apps[@]}"; do
  echo "⬆️  Pushing $app..."
  docker push $REGISTRY_USER/lv-$app:$VERSION
done

echo ""
echo " All images pushed successfully!"
echo "Images available at: docker pull $REGISTRY_USER/lv-{app}:$VERSION"
```

### 5. Tạo Simple Docker Compose Files (No DB containers!)

**File: `deploys/gateway.yml`**

```yaml
version: '3.8'

services:
  gateway:
    image: ${DOCKER_USERNAME}/lv-gateway:${VERSION:-latest}
    container_name: gateway
    ports:
      - '3000:3000'
    environment:
      - PORT=3000
      - NATS_URL=${NATS_URL:-nats://localhost:4222}
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
    restart: unless-stopped
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

**File: `deploys/user-app.yml`**

```yaml
version: '3.8'

services:
  user-app:
    image: ${DOCKER_USERNAME}/lv-user-app:${VERSION:-latest}
    container_name: user-app
    environment:
      - DATABASE_URL_USER=${DATABASE_URL_USER}
      - NATS_URL=${NATS_URL:-nats://localhost:4222}
    restart: unless-stopped
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

**6 Other Microservices Compose Files:**

Pattern tương tự, thay đổi:

- Image name
- Container name
- DATABASE_URL variable name
- Files: `product-app.yml`, `order-app.yml`, `cart-app.yml`, `payment-app.yml`, `report-app.yml`, `ar-app.yml`

### 6. Tạo Environment Configuration

**File: `deploys/.env.example`**

```env
# Docker Registry
DOCKER_USERNAME=yourusername
VERSION=latest

# NATS Server
NATS_URL=nats://your-nats-host:4222

# Database URLs (External PostgreSQL Server)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Option 1: Multiple databases on same server
DATABASE_URL_USER=postgresql://postgres:password@db-server:5432/user_db
DATABASE_URL_PRODUCT=postgresql://postgres:password@db-server:5432/product_db
DATABASE_URL_ORDER=postgresql://postgres:password@db-server:5432/order_db
DATABASE_URL_CART=postgresql://postgres:password@db-server:5432/cart_db
DATABASE_URL_PAYMENT=postgresql://postgres:password@db-server:5432/payment_db
DATABASE_URL_REPORT=postgresql://postgres:password@db-server:5432/report_db
DATABASE_URL_AR=postgresql://postgres:password@db-server:5432/ar_db

# Option 2: Same database with different schemas
# DATABASE_URL_USER=postgresql://postgres:password@db-server:5432/luan_van?schema=user_schema
# DATABASE_URL_PRODUCT=postgresql://postgres:password@db-server:5432/luan_van?schema=product_schema
# ... etc

# Gateway
CORS_ORIGIN=http://localhost:3001,http://your-frontend.com
```

### 7. Tạo Database Setup Scripts

**File: `scripts/setup-databases.sql`**

```sql
-- Run this on PostgreSQL server to create all databases
CREATE DATABASE user_db;
CREATE DATABASE product_db;
CREATE DATABASE order_db;
CREATE DATABASE cart_db;
CREATE DATABASE payment_db;
CREATE DATABASE report_db;
CREATE DATABASE ar_db;

-- Optional: Create dedicated users per database
CREATE USER user_app WITH PASSWORD 'user_password';
GRANT ALL PRIVILEGES ON DATABASE user_db TO user_app;

CREATE USER product_app WITH PASSWORD 'product_password';
GRANT ALL PRIVILEGES ON DATABASE product_db TO product_app;

-- ... repeat for other services
```

**File: `scripts/run-all-migrations.sh`**

```bash
#!/bin/bash
# Run migrations for all apps (from build machine or CI)

apps=("user-app" "product-app" "order-app" "cart-app" "payment-app" "report-app" "ar-app")

for app in "${apps[@]}"; do
  echo "Running migrations for $app..."
  npx prisma migrate deploy --schema=apps/${app}/prisma/schema.prisma
done

echo " All migrations completed!"
```

### 8. Tạo .dockerignore

**File: `.dockerignore`**

```
node_modules/
dist/
coverage/
.git/
.env*
*.log
apps/*/prisma/generated/
keys/
test/
*.spec.ts
*.e2e-spec.ts
.github/
docs/
```

### 9. Tạo Comprehensive Deployment Guide

**File: `deploys/README.md`**

Sections:

- Architecture Overview
- Prerequisites
- Database Server Setup
- NATS Server Setup
- Build & Push Workflow
- Host-by-Host Deployment Guide
- Environment Variables Reference
- Troubleshooting
- Monitoring & Logs
- Rollback Procedures
- Appendix: Connection String Examples

### 10. Tạo Deployment Helper Scripts

**File: `deploys/deploy.sh`**

```bash
#!/bin/bash
set -e

APP_NAME=$1

if [ -z "$APP_NAME" ]; then
  echo "Usage: ./deploy.sh <app-name>"
  echo "Available apps: gateway, user-app, product-app, order-app, cart-app, payment-app, report-app, ar-app"
  exit 1
fi

if [ ! -f "${APP_NAME}.yml" ]; then
  echo "Error: ${APP_NAME}.yml not found"
  exit 1
fi

echo " Deploying $APP_NAME..."
docker compose -f ${APP_NAME}.yml pull
docker compose -f ${APP_NAME}.yml up -d
echo " $APP_NAME deployed!"
echo ""
echo " Logs:"
docker compose -f ${APP_NAME}.yml logs -f
```

**File: `deploys/status-all.sh`**

```bash
#!/bin/bash
# Check status of all deployed services

apps=(gateway user-app product-app order-app cart-app payment-app report-app ar-app)

echo "📊 Service Status:"
echo "================================"

for app in "${apps[@]}"; do
  if [ -f "${app}.yml" ]; then
    status=$(docker compose -f ${app}.yml ps --format json 2>/dev/null | jq -r '.[0].State' 2>/dev/null || echo "not deployed")
    echo "$app: $status"
  fi
done
```

## Complete Deployment Workflow

### One-Time Setup

**1. Setup Database Server:**

```bash
# On database server host
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# Create databases
docker exec -i postgres psql -U postgres < setup-databases.sql
```

**2. Setup NATS Server:**

```bash
# On NATS server host
docker run -d \
  --name nats \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:alpine
```

**3. Build & Push Images (Local or CI):**

```bash
# Set credentials
export DOCKER_USERNAME=yourusername
export VERSION=v1.0.0

# Build
./scripts/build-all-images.sh

# Login and push
docker login
./scripts/push-all-images.sh
```

### Deployment trên mỗi App Host

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Chỉ cần folder deploys (có thể git sparse-checkout)
mkdir -p ~/app-deployment
cd ~/app-deployment
# Copy deploys/ folder hoặc git clone

# 3. Configure environment
cp .env.example .env
nano .env  # Update DATABASE_URL, NATS_URL, etc.

# 4. Deploy specific app
./deploy.sh user-app
```

### Startup Order (Important!)

1.  Database Server
2.  NATS Server
3.  User-app (publishes public key)
4.  Gateway (receives public key)
5.  Other microservices (bất kỳ thứ tự)

## Benefits Summary

### Simplicity

- Docker compose files CỰC KỲ đơn giản (4-5 dòng)
- No database containers to manage
- No volumes, healthchecks, depends_on
- Faster startup and restart

### Flexibility

- Dễ dàng switch database configurations
- Có thể dùng 1 DB server hoặc nhiều DB servers
- Có thể dùng managed databases (AWS RDS, etc.)
- Database schemas có thể shared hoặc separated

### Production-Ready

- Separate database tier (real-world architecture)
- Independent scaling (scale apps không ảnh hưởng DB)
- Centralized backup/restore
- Professional approach cho luận văn

### Deployment

- Build once, deploy nhiều lần
- Image-based deployment (consistency)
- Version control qua tags
- Easy rollback

## Presentation Points for Luận Văn

1. **Microservices Architecture**: 8 independent services
2. **Containerization**: Docker best practices, multi-stage builds
3. **Service Discovery**: Dynamic key distribution qua NATS
4. **Database Per Service**: Logical separation with flexible physical deployment
5. **CI/CD Ready**: Automated build and push workflow
6. **Scalability**: Independent scaling per service
7. **Security**: JWT asymmetric keys, environment-based secrets
8. **Observability**: Centralized logging, health checks
