# Quick Start - Docker Deployment

**Time required:** 15 minutes (after initial setup)

---

## One-Command Deployment

### Before First Deployment (Local - One time only)

```bash
# 1. Generate migrations
pnpm run db:migrate:all

# 2. Commit
git add apps/*/prisma/migrations/
git commit -m "chore: initial migrations"
git push
```

### Build & Push Images

```bash
# On build machine (local/CI)
export DOCKER_USERNAME=your_docker_username
export VERSION=v1.0.0

# Build all
./scripts/build-all-images.sh

# Push to Docker Hub
./scripts/push-all-images.sh
```

### Deploy to Hosts

**Setup infrastructure (once):**

```bash
# Host for PostgreSQL
docker run -d --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16-alpine

# Host for NATS
docker run -d --name nats -p 4222:4222 nats:alpine
```

**Deploy each app (repeat per host):**

```bash
# SSH to host
ssh user@app-host-1

# Clone & setup
git clone <repo> backend-luan-van
cd backend-luan-van/deploys
cp .env.example .env
nano .env

# Deploy
./deploy.sh gateway     # Host 1
./deploy.sh user-app    # Host 2
./deploy.sh product-app # Host 3
# ... etc
```

---

## Verify Deployment

```bash
# Check all services
./status-all.sh

# Test gateway
curl http://localhost:3000/health
```

---

## .env Template

```env
DOCKER_USERNAME=yourusername
VERSION=v1.0.0
NATS_URL=nats://nats-server-ip:4222
DATABASE_URL_USER=postgresql://postgres:password@db-server:5432/user_db
DATABASE_URL_PRODUCT=postgresql://postgres:password@db-server:5432/product_db
DATABASE_URL_ORDER=postgresql://postgres:password@db-server:5432/order_db
DATABASE_URL_CART=postgresql://postgres:password@db-server:5432/cart_db
DATABASE_URL_PAYMENT=postgresql://postgres:password@db-server:5432/payment_db
DATABASE_URL_REPORT=postgresql://postgres:password@db-server:5432/report_db
DATABASE_URL_AR=postgresql://postgres:password@db-server:5432/ar_db
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
LOG_LEVEL=debug
NODE_ENV=production
```

---

## Startup Order (CRITICAL!)

```
1. PostgreSQL Server
2. NATS Server
3. User-app (waits 60 seconds)
4. Gateway (waits 30 seconds)
5. Other services
```

**If wrong order → Gateway timeout → JWT error!**

---

## Common Tasks

### View Logs

```bash
docker compose -f user-app.yml logs -f
```

### Restart Service

```bash
docker compose -f user-app.yml restart user-app
```

### Pull New Version

```bash
export VERSION=v1.1.0
docker compose -f user-app.yml pull
docker compose -f user-app.yml up -d
```

### Check Database

```bash
psql -h db-server -U postgres -d user_db
```

---

## Full Documentation

- `deploys/README.md` - Comprehensive guide
- `DEPLOYMENT_GUIDE_VI.md` - Detailed guide (Vietnamese)
- `DEPLOYMENT_SUMMARY.md` - What was implemented

---

## Timeline

| Phase      | Duration  | Steps                           |
| ---------- | --------- | ------------------------------- |
| **Setup**  | 1 hour    | Databases, NATS, Docker Hub     |
| **Build**  | 10 min    | `./scripts/build-all-images.sh` |
| **Push**   | 5 min     | `./scripts/push-all-images.sh`  |
| **Deploy** | 2 min/app | `./deploy.sh app-name` × 8      |
| **Test**   | 5 min     | `./status-all.sh` + curl tests  |

**Total:** ~2 hours for first complete deployment

---
