# ��� Hướng Dẫn Sử Dụng Docker Deployment

Hướng dẫn đầy đủ để triển khai hệ thống microservices lên các host riêng biệt.

## ��� Tóm Tắt Nhanh

**Giải pháp deployment:**

- Build Docker images một lần
- Push lên Docker Hub
- Deploy lên các host khác nhau
- Mỗi microservice chạy độc lập
- Kết nối database server bên ngoài
- Tự động distribute JWT public key qua NATS

---

## ��� Quy Trình Deployment

### Phase 1️⃣: Chuẩn Bị (Local Machine - 1 lần)

#### Step 1: Tạo Initial Migrations

```bash
cd backend-luan-van

# Install dependencies
pnpm install

# Generate Prisma clients
pnpm run db:gen:all

# Tạo initial migrations (CRITICAL!)
pnpm run db:migrate:all

# Verify
ls -la apps/*/prisma/migrations/
```

**Output:**

```
apps/user-app/prisma/migrations/20241113_init/
apps/product-app/prisma/migrations/20241113_init/
apps/order-app/prisma/migrations/20241113_init/
apps/cart-app/prisma/migrations/20241113_init/
apps/payment-app/prisma/migrations/20241113_init/
apps/report-app/prisma/migrations/20241113_init/
apps/ar-app/prisma/migrations/20241113_init/
```

#### Step 2: Commit Migrations

```bash
git add apps/*/prisma/migrations/
git commit -m "chore: initial database migrations"
git push origin main
```

#### Step 3: Setup PostgreSQL Server

**Tùy chọn A: Docker**

```bash
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# Create databases
docker exec -i postgres psql -U postgres < backend-luan-van/scripts/setup-databases.sql
```

**Tùy chọn B: Managed Service**

- AWS RDS
- DigitalOcean Database
- Azure Database for PostgreSQL
- Google Cloud SQL

Tạo 7 databases:

```sql
CREATE DATABASE user_db;
CREATE DATABASE product_db;
CREATE DATABASE order_db;
CREATE DATABASE cart_db;
CREATE DATABASE payment_db;
CREATE DATABASE report_db;
CREATE DATABASE ar_db;
```

#### Step 4: Setup NATS Server

**Docker:**

```bash
docker run -d \
  --name nats \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:alpine
```

**Managed:**

- NATS Cloud
- Kubernetes (Helm chart)

#### Step 5: Login Docker Hub

```bash
docker login
# Nhập username/password
```

---

### Phase 2️⃣: Build & Push Images

#### Lệnh Build

```bash
cd backend-luan-van

# Set environment
export DOCKER_USERNAME=your_docker_username
export VERSION=v1.0.0

# Build all images (5-10 phút)
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh
```

**Output:**

```
 All images built successfully!
��� Built images:
lv-gateway:v1.0.0
lv-user-app:v1.0.0
lv-product-app:v1.0.0
lv-order-app:v1.0.0
lv-cart-app:v1.0.0
lv-payment-app:v1.0.0
lv-report-app:v1.0.0
lv-ar-app:v1.0.0
```

#### Lệnh Push

```bash
chmod +x scripts/push-all-images.sh
./scripts/push-all-images.sh
```

**Output:**

```
 All images pushed successfully!

��� Images available at Docker Hub:
docker pull your_username/lv-gateway:v1.0.0
docker pull your_username/lv-user-app:v1.0.0
... etc
```

---

### Phase 3️⃣: Deploy trên Các Host

#### Host 1: Gateway (API Server)

```bash
# 1. SSH vào host
ssh user@gateway-host

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone repo
git clone <your-repo> backend-luan-van
cd backend-luan-van/deploys

# 4. Create .env
cp .env.example .env
nano .env
```

**Edit .env:**

```env
DOCKER_USERNAME=your_username
VERSION=v1.0.0
NATS_URL=nats://nats-server-ip:4222
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
```

**Deploy:**

```bash
chmod +x deploy.sh
./deploy.sh gateway

# Verify
curl http://localhost:3000/health
```

#### Host 2: User-app

```bash
ssh user@user-app-host

git clone <your-repo> backend-luan-van
cd backend-luan-van/deploys

cp .env.example .env
nano .env
```

**Edit .env:**

```env
DOCKER_USERNAME=your_username
VERSION=v1.0.0
NATS_URL=nats://nats-server-ip:4222
DATABASE_URL_USER=postgresql://postgres:password@db-server:5432/user_db
```

**Deploy:**

```bash
./deploy.sh user-app

# Migrations chạy tự động!
docker compose -f user-app.yml logs -f user-app
```

#### Host 3-8: Other Services

Lặp lại process tương tự cho:

- product-app
- order-app
- cart-app
- payment-app
- report-app
- ar-app

**Chỉ khác:** mỗi app chỉ cần DATABASE_URL riêng

---

## ⏱️ Startup Order (IMPORTANT!)

**Phải start theo thứ tự này:**

1. **PostgreSQL Server** ⏳ chờ 30 giây
2. **NATS Server** ⏳ chờ 30 giây
3. **User-app** ⏳ chờ 60 giây (phải publish public key trước)
4. **Gateway** ⏳ chờ 30 giây (nhận public key từ user-app)
5. **Các service khác** (bất kỳ thứ tự)

**Nếu startup sai thứ tự:**

```
 Gateway khởi động trước user-app
  → Gateway timeout chờ public key
  → Lỗi: "Public key not received"

 User-app → Gateway → Others
  → Public key được publish
  → Gateway nhận và cache
  → Mọi thứ hoạt động
```

---

## ��� Kiểm Tra & Debug

### Check Status Tất Cả Services

```bash
cd backend-luan-van/deploys
./status-all.sh

# Output:
# gateway:          running (ID: abc123def456)
# user-app:         running (ID: xyz789uvw123)
# product-app:      running (ID: def456ghi789)
# ... etc
# Summary: 8/8 services running
#  All services operational!
```

### View Logs

```bash
# Real-time logs
docker compose -f user-app.yml logs -f user-app

# Last 100 lines
docker compose -f user-app.yml logs --tail=100

# Error logs only
docker compose -f user-app.yml logs | grep ERROR
```

### Test API

```bash
# Test gateway
curl http://localhost:3000/health

# Should return 200 OK

# Test with JWT token
curl -H "Authorization: Bearer <token>" http://localhost:3000/users
```

### Check Database

```bash
# Connect to PostgreSQL
psql -h db-server -U postgres -d user_db

# Inside psql:
\dt              # List tables
SELECT * FROM "User" LIMIT 5;  # Check data
\q               # Exit
```

### Test NATS

```bash
# From any app host
nats -s nats://nats-server:4222 sub ">"

# From another terminal
nats -s nats://nats-server:4222 pub test "hello"

# Should see message received
```

---

## ��� Common Commands

### Restart Service

```bash
cd backend-luan-van/deploys
docker compose -f user-app.yml restart user-app
```

### Stop Service

```bash
docker compose -f user-app.yml stop user-app
```

### Remove Container (để rebuild)

```bash
docker compose -f user-app.yml down
```

### Pull New Image

```bash
export VERSION=v1.1.0
docker compose -f user-app.yml pull
docker compose -f user-app.yml up -d
```

### View Container Info

```bash
docker ps | grep user-app
docker inspect <container-id>
```

---

## ��� Environment Variables

### Cấu Trúc .env

```env
# ============ Docker Registry ============
DOCKER_USERNAME=your_docker_username
VERSION=v1.0.0

# ============ NATS ============
NATS_URL=nats://nats-server-ip:4222

# ============ Databases ============
DATABASE_URL_USER=postgresql://user:pass@db-host:5432/user_db
DATABASE_URL_PRODUCT=postgresql://user:pass@db-host:5432/product_db
DATABASE_URL_ORDER=postgresql://user:pass@db-host:5432/order_db
DATABASE_URL_CART=postgresql://user:pass@db-host:5432/cart_db
DATABASE_URL_PAYMENT=postgresql://user:pass@db-host:5432/payment_db
DATABASE_URL_REPORT=postgresql://user:pass@db-host:5432/report_db
DATABASE_URL_AR=postgresql://user:pass@db-host:5432/ar_db

# ============ Gateway ============
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# ============ Logging ============
LOG_LEVEL=debug
NODE_ENV=production
```

### Format Connection String

```
postgresql://username:password@hostname:port/database

Ví dụ:
postgresql://postgres:mypassword@192.168.1.100:5432/user_db
postgresql://user@localhost:5432/product_db
postgresql://admin:p@ss123@db.example.com:5432/order_db?schema=public
```

---

## ⚠️ Troubleshooting

### Gateway không start

```bash
docker compose -f gateway.yml logs gateway

# Check cho:
# - NATS connection error
# - Public key timeout
# - Port 3000 đang bị chiếm
```

**Fix:**

```bash
# Check NATS
nats -s nats://localhost:4222 sub ">"

# Kill existing process trên port 3000
lsof -i :3000
kill -9 <PID>

# Restart
docker compose -f gateway.yml up -d
```

### User-app failed to start

```bash
docker compose -f user-app.yml logs user-app

# Check cho:
# - Database connection error
# - Migration failed
# - NATS connection error
```

**Fix:**

```bash
# Test database connection
psql -h db-server -U postgres -d user_db

# Check DATABASE_URL_USER format
echo $DATABASE_URL_USER

# View migrations
docker exec user-app ls apps/user-app/prisma/migrations/

# Restart
docker compose -f user-app.yml restart user-app
```

### JWT Token Verification Failed

```bash
# Logs
docker compose -f gateway.yml logs | grep "verification"

# Check user-app published key
docker compose -f user-app.yml logs | grep "Public key"

# Restart sequence
docker compose -f user-app.yml restart user-app
sleep 5
docker compose -f gateway.yml restart gateway
```

### Database Migrations Failed

```bash
docker compose -f user-app.yml logs user-app

# Scenarios:
# 1. Migrations chưa tồn tại
#    → Chạy: pnpm run db:migrate:all (ở local)
#    → Commit migrations
#    → Rebuild images

# 2. Permission error
#    → Check DATABASE_URL credentials
#    → Check PostgreSQL user permissions

# 3. Schema mismatch
#    → Xóa database, tạo lại
#    → psql -h db-server -U postgres -c "DROP DATABASE user_db;"
#    → psql -h db-server -U postgres < setup-databases.sql
```

---

## ��� Update & Rollback

### Update to New Version

```bash
# Build new version locally
export VERSION=v1.1.0
./scripts/build-all-images.sh
./scripts/push-all-images.sh

# On each host
export VERSION=v1.1.0
docker compose -f user-app.yml pull
docker compose -f user-app.yml up -d
```

### Rollback to Previous Version

```bash
# On host
export VERSION=v1.0.0
docker compose -f user-app.yml pull
docker compose -f user-app.yml up -d

# Verify
docker compose -f user-app.yml logs user-app
```

---

## ��� Performance Tips

### Resource Limits

Edit `app-name.yml`:

```yaml
services:
  app-name:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Monitor Resource Usage

```bash
docker stats
docker compose -f user-app.yml stats
```

### Database Optimization

```sql
-- Check connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Check slow queries
SELECT query, mean_time, calls FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

---

## ��� Quick Reference

### Copy-Paste Commands

**Setup NATS:**

```bash
docker run -d --name nats -p 4222:4222 -p 8222:8222 nats:alpine
```

**Setup PostgreSQL:**

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -v pgdata:/var/lib/postgresql/data postgres:16-alpine
```

**Deploy Gateway:**

```bash
cd deploys && cp .env.example .env && ./deploy.sh gateway
```

**Deploy User-app:**

```bash
export DATABASE_URL_USER=postgresql://postgres:password@db-server:5432/user_db
cd deploys && ./deploy.sh user-app
```

**Check All Services:**

```bash
./status-all.sh
```

---

## ��� Support

### Logs Location

```bash
# All containers
docker ps -a

# Specific app logs
docker compose -f user-app.yml logs --tail=100

# Follow logs
docker compose -f user-app.yml logs -f
```

### Health Checks

```bash
# Gateway
curl http://localhost:3000/health

# Database
psql -h db-server -U postgres -c "SELECT 1"

# NATS
nats -s nats://localhost:4222 sub "test" &
```

### Documentation

- Main: `deploys/README.md` - Comprehensive guide
- This file: `DEPLOYMENT_GUIDE_VI.md` - Usage guide (Vietnamese)
- Docker: `Dockerfile.*` - Build specs
- Scripts: `scripts/build-all-images.sh`, `scripts/push-all-images.sh`

---

## Checklist

**Pre-Deployment:**

- [ ] Generated migrations: `pnpm run db:migrate:all`
- [ ] Committed migrations to git
- [ ] PostgreSQL server setup
- [ ] NATS server setup
- [ ] Docker Hub account created

**Build Phase:**

- [ ] Set DOCKER_USERNAME
- [ ] Set VERSION
- [ ] Run: `./scripts/build-all-images.sh`
- [ ] Run: `./scripts/push-all-images.sh`

**Deployment:**

- [ ] Host 1: Gateway
- [ ] Host 2: User-app (wait 60 seconds for key)
- [ ] Host 3+: Other services
- [ ] Test: `./status-all.sh`
- [ ] Test: `curl localhost:3000/health`

**Post-Deployment:**

- [ ] Monitor logs
- [ ] Check resource usage
- [ ] Verify database connectivity
- [ ] Test API endpoints

---

**Created:** 2024-11-13
**Version:** 1.0.0
**Language:** Vietnamese
