# Docker Deployment Guide - Luận Văn Ecommerce

Complete guide for deploying microservices architecture using Docker, Docker Compose, and external PostgreSQL databases.

## ��� Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup (One-Time)](#initial-setup-one-time)
4. [Build & Push Images](#build--push-images)
5. [Deployment on Each Host](#deployment-on-each-host)
6. [Configuration Reference](#configuration-reference)
7. [Troubleshooting](#troubleshooting)
8. [Security Notes](#security-notes)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Registry (Docker Hub)                 │
│  lv-gateway:latest, lv-user-app:latest, lv-product-app:latest  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ pull
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    Host 1              Host 2              Host 3
   Gateway          User-app            Product-app
  Port 3000     + PostgreSQL           + PostgreSQL
               (external DB)           (external DB)
                     ↓
        ┌────────────────────────────┐
        │  PostgreSQL Server (1 host) │
        │  - user_db                  │
        │  - product_db               │
        │  - order_db                 │
        │  - cart_db                  │
        │  - payment_db               │
        │  - report_db                │
        │  - ar_db                    │
        └────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │   NATS Server (1 host)      │
        │   nats://nats-host:4222     │
        └────────────────────────────┘
```

## Prerequisites

### For Each Host

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum per container
- Internet access to pull images from Docker Hub

### For PostgreSQL Server (1 host)

- PostgreSQL 14+
- 4GB RAM minimum
- Network access from all app hosts (port 5432)

### For NATS Server (1 host)

- NATS 2.8+
- Network access from all apps (port 4222)

---

## Initial Setup (One-Time)

### Step 1: Generate Initial Migrations (Local/CI Machine)

**CRITICAL**: Must be done before building images!

```bash
# From project root (backend-luan-van)
cd backend-luan-van

# Install dependencies
pnpm install

# Generate Prisma clients
pnpm run db:gen:all

# Generate initial migrations for ALL apps
pnpm run db:migrate:all

# Verify migrations were created
ls -la apps/*/prisma/migrations/

# You should see directories like:
# apps/user-app/prisma/migrations/20241113_init/
# apps/product-app/prisma/migrations/20241113_init/
# ... etc
```

**Output:**

```
 Successfully created migrations:
  - apps/user-app/prisma/migrations/20241113_init/migration.sql
  - apps/product-app/prisma/migrations/20241113_init/migration.sql
  - apps/order-app/prisma/migrations/20241113_init/migration.sql
  - apps/cart-app/prisma/migrations/20241113_init/migration.sql
  - apps/payment-app/prisma/migrations/20241113_init/migration.sql
  - apps/report-app/prisma/migrations/20241113_init/migration.sql
  - apps/ar-app/prisma/migrations/20241113_init/migration.sql
```

### Step 2: Commit Migrations to Git

```bash
git add apps/*/prisma/migrations/
git commit -m "chore: initial database migrations for all services"
git push origin main
```

### Step 3: Setup PostgreSQL Server

On PostgreSQL server host:

```bash
# Option 1: Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

# Option 2: Managed service (AWS RDS, DigitalOcean, etc.)
# Create databases manually or run setup script

# Create databases (run this on PostgreSQL)
docker exec -i postgres psql -U postgres < scripts/setup-databases.sql

# Or manually:
docker exec -it postgres psql -U postgres
# Inside psql:
# CREATE DATABASE user_db;
# CREATE DATABASE product_db;
# ... etc
```

### Step 4: Setup NATS Server

```bash
# Option 1: Docker
docker run -d \
  --name nats \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:alpine

# Option 2: Managed service (NATS Cloud, etc.)
# Get connection URL from provider
```

**Test NATS connection:**

```bash
nats -s nats://your-nats-server:4222 pub test "hello"
```

### Step 5: Setup Docker Hub Account

```bash
# Create free account at https://hub.docker.com

# Login locally
docker login

# You'll be prompted for username/password
# Username will be used as DOCKER_USERNAME
```

---

## Build & Push Images

### On Build Machine (Local or CI)

```bash
cd backend-luan-van

# Set environment variables
export DOCKER_USERNAME=your_docker_username
export VERSION=v1.0.0  # or 'latest' for development

# Build all images (takes ~5-10 minutes)
chmod +x scripts/build-all-images.sh
./scripts/build-all-images.sh

# Output:
#  All images built successfully!
# lv-gateway:v1.0.0
# lv-user-app:v1.0.0
# lv-product-app:v1.0.0
# ... etc

# Push to Docker Hub
chmod +x scripts/push-all-images.sh
./scripts/push-all-images.sh

# Output:
#  All images pushed successfully!
# Images available at Docker Hub:
#   docker pull your_docker_username/lv-gateway:v1.0.0
#   docker pull your_docker_username/lv-user-app:v1.0.0
#   ... etc
```

**Images are now available for all hosts to pull!**

---

## Deployment on Each Host

### Quick Start (5 minutes)

```bash
# 1. SSH to host
ssh user@app-host-1

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Get deployment files
git clone <your-repo> backend-luan-van
cd backend-luan-van/deploys

# 4. Configure environment
cp .env.example .env
nano .env  # Edit DOCKER_USERNAME, NATS_URL, DATABASE_URLs

# 5. Deploy specific app (e.g., user-app)
chmod +x *.sh
./deploy.sh user-app

# 6. Check logs
docker compose -f user-app.yml logs -f user-app
```

### Detailed Deployment Guide

#### Host 1: Gateway (API Server)

```bash
# SSH to host
ssh user@gateway-host

# Setup
cd backend-luan-van/deploys
cp .env.example .env

# Edit .env
nano .env
# Update:
# - DOCKER_USERNAME=your_username
# - VERSION=v1.0.0
# - NATS_URL=nats://nats-host:4222
# - CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# Deploy
./deploy.sh gateway

# Verify
curl http://localhost:3000/health
# Expected response: 200 OK
```

#### Host 2: User-app

```bash
ssh user@user-app-host

cd backend-luan-van/deploys
cp .env.example .env

# Edit .env
nano .env
# Update:
# - DOCKER_USERNAME=your_username
# - VERSION=v1.0.0
# - NATS_URL=nats://nats-host:4222
# - DATABASE_URL_USER=postgresql://postgres:password@db-host:5432/user_db

# Deploy (user-app will auto-run migrations!)
./deploy.sh user-app

# Check logs
docker compose -f user-app.yml logs -f user-app
```

#### Host 3-8: Other Microservices

Repeat similar process for each app:

- product-app
- order-app
- cart-app
- payment-app
- report-app
- ar-app

**Key difference**: Each app only needs its corresponding `DATABASE_URL_*` variable.

### Startup Order (Important!)

1. **PostgreSQL Server** (if not managed service)
2. **NATS Server** (if not managed service)
3. **User-app** (publishes public key for JWT)
4. **Gateway** (receives public key and waits)
5. **Other microservices** (any order)

**Wait 1-2 minutes between each startup for stabilization.**

---

## Configuration Reference

### .env File Variables

```env
# Docker Registry
DOCKER_USERNAME=your_docker_hub_username
VERSION=v1.0.0

# NATS Server
NATS_URL=nats://nats-server-ip:4222

# Database URLs
DATABASE_URL_USER=postgresql://postgres:password@db-server:5432/user_db
DATABASE_URL_PRODUCT=postgresql://postgres:password@db-server:5432/product_db
DATABASE_URL_ORDER=postgresql://postgres:password@db-server:5432/order_db
DATABASE_URL_CART=postgresql://postgres:password@db-server:5432/cart_db
DATABASE_URL_PAYMENT=postgresql://postgres:password@db-server:5432/payment_db
DATABASE_URL_REPORT=postgresql://postgres:password@db-server:5432/report_db
DATABASE_URL_AR=postgresql://postgres:password@db-server:5432/ar_db

# Gateway
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# Logging
LOG_LEVEL=debug
NODE_ENV=production
```

### Connection String Formats

**Standard PostgreSQL:**

```
postgresql://user:password@host:port/database
```

**With SSH tunnel:**

```
postgresql://user:password@localhost:5432/database
# After: ssh -L 5432:remote-db:5432 user@remote-host
```

**With schema (optional):**

```
postgresql://user:password@host:5432/database?schema=user_schema
```

---

## JWT Public Key Distribution

**How it works (automatic):**

1. **User-app startup**:
   - Generates RSA key pair (if not exists)
   - Publishes public key to NATS (`auth.public-key`)

2. **Gateway startup**:
   - Subscribes to NATS channel
   - Waits for public key message
   - Caches public key in memory
   - Starts HTTP server

3. **Runtime**:
   - Gateway verifies JWT tokens with cached public key
   - Supports key rotation (user-app publishes new key)

**No manual key distribution needed!**

---

## Common Commands

### Check Container Status

```bash
# On each host
docker compose -f app-name.yml ps

# Output should show: healthy or running
```

### View Logs

```bash
# Real-time logs
docker compose -f user-app.yml logs -f user-app

# Last 100 lines
docker compose -f user-app.yml logs --tail=100

# Filter by pattern
docker compose -f user-app.yml logs | grep "ERROR"
```

### Run Migrations Manually

```bash
# If needed, manually run migrations
docker compose -f user-app.yml exec user-app \
  npx prisma migrate deploy --schema=apps/user-app/prisma/schema.prisma
```

### Database Connection

```bash
# Connect to PostgreSQL server
psql -h db-host -U postgres -d user_db

# Check tables
\dt

# List databases
\l
```

### Restart Service

```bash
docker compose -f user-app.yml restart user-app
```

### Pull Latest Images

```bash
# Update to new version
export VERSION=v1.1.0
docker compose -f user-app.yml pull
docker compose -f user-app.yml up -d
```

---

## Troubleshooting

### Container fails to start

**Check logs:**

```bash
docker compose -f app-name.yml logs app-name
```

**Common issues:**

- Database not reachable: Check DATABASE_URL and network
- NATS not reachable: Check NATS_URL and network
- Migrations failed: Check permissions on PostgreSQL

### Gateway can't verify JWT tokens

**Symptoms:** "Token verification failed" errors

**Check:**

1. User-app is running and published public key
2. Gateway logs show "Public key received"
3. NATS connectivity between services

```bash
# Check user-app logs
docker compose -f user-app.yml logs | grep "Public key"

# Check gateway logs
docker compose -f gateway.yml logs | grep "Public key"
```

### Database migrations failed

**Check:**

```bash
docker compose -f user-app.yml logs user-app
```

**Solutions:**

1. Ensure migrations exist in image
2. Check DATABASE_URL format
3. Verify PostgreSQL server is accessible
4. Check database credentials and permissions

### Network connectivity issues

**Test NATS:**

```bash
# From any app host
nc -zv nats-server 4222  # Should return: success
```

**Test PostgreSQL:**

```bash
# From app host
psql -h db-server -U postgres -c "SELECT 1"
```

---

## Security Notes

### 1. Environment Variables

**Never commit .env file!**

```bash
echo ".env" >> .gitignore
git rm --cached .env
```

### 2. Database Credentials

- Use strong passwords (20+ characters)
- Different password for each environment
- Store in secrets manager (AWS Secrets Manager, HashiCorp Vault)

### 3. Network Security

- Restrict PostgreSQL access to app hosts only
- Use VPC security groups if on cloud
- Don't expose NATS to public internet

### 4. Docker Registry

- Use private Docker Hub repos if containing secrets
- Enable image scanning for vulnerabilities
- Regularly update base images

### 5. JWT Keys

- Private key never leaves user-app container
- Public key distributed automatically via NATS
- Rotate keys periodically

---

## Version Management

### Tagging Strategy

```bash
# Development (latest)
export VERSION=latest
./scripts/build-all-images.sh

# Staging
export VERSION=staging-v1.0
./scripts/build-all-images.sh

# Production release
export VERSION=v1.0.0
./scripts/build-all-images.sh
```

### Rollback to Previous Version

```bash
# On host, update .env
export VERSION=v0.9.0

# Restart services
docker compose -f app-name.yml pull
docker compose -f app-name.yml up -d
```

---

## Performance Tuning

### Container Resource Limits

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

### Logging

Keep logs manageable:

```yaml
services:
  app-name:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

---

## Monitoring

### Health Checks

Gateway has built-in health endpoint:

```bash
curl http://gateway-host:3000/health
# Returns: 200 OK if healthy
```

### View Resource Usage

```bash
docker stats
```

### Check Database Connections

```bash
psql -h db-host -U postgres -d user_db
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

---

## Support & Troubleshooting

### Check System Status

```bash
./scripts/status-all.sh
```

### Manual Deploy

```bash
./scripts/deploy.sh user-app
```

### View All Logs

```bash
docker compose -f *.yml logs
```

---

## Architecture Benefits

**Scalability**: Scale each service independently
**Reliability**: Container isolation, auto-restart
**Flexibility**: Deploy to any host with Docker
**Version Control**: Track image versions with tags
**Consistency**: Build once, deploy everywhere
**Security**: Keys distributed automatically
**Production-Ready**: Industry-standard practices

---

## Next Steps

1.  Generate migrations (`pnpm run db:migrate:all`)
2.  Setup PostgreSQL and NATS servers
3.  Build and push images
4.  Deploy gateway on first host
5.  Deploy user-app on second host
6.  Deploy other services
7.  Test API endpoints
8.  Setup monitoring and logging

---

Last updated: 2024-11-13
