# Docker Configurations

This directory contains all Dockerfile definitions for the backend microservices architecture.

## Structure

```
docker/
├── gateway/
│   └── Dockerfile              # Gateway service
├── microservices/
│   ├── user-app/
│   │   └── Dockerfile          # User management service
│   ├── product-app/
│   │   └── Dockerfile          # Product management service
│   ├── order-app/
│   │   └── Dockerfile          # Order management service
│   ├── cart-app/
│   │   └── Dockerfile          # Shopping cart service
│   ├── payment-app/
│   │   └── Dockerfile          # Payment processing service
│   ├── report-app/
│   │   └── Dockerfile          # Report generation service
│   └── ar-app/
│       └── Dockerfile          # Augmented Reality service
└── README.md                    # This file
```

## Building Images

### Build All Images

```bash
./scripts/build-all-images.sh
```

Environment variables (optional):
- `DOCKER_USERNAME`: Docker registry username (default: `haongo123`)
- `VERSION`: Image version tag (default: `latest`)

Example:
```bash
DOCKER_USERNAME=yourusername VERSION=1.0.0 ./scripts/build-all-images.sh
```

### Build Specific Image

```bash
# Build gateway
docker build -t your-registry/lv-gateway:latest -f docker/gateway/Dockerfile .

# Build user-app
docker build -t your-registry/lv-user-app:latest -f docker/microservices/user-app/Dockerfile .
```

## Pushing Images

```bash
./scripts/push-all-images.sh
```

Prerequisites:
- `docker login` must be executed first

## Image Optimization

All Dockerfiles use **4-stage multi-stage builds** for optimal image size:

1. **deps** - Install dependencies with `pnpm install --frozen-lockfile`
2. **builder** - Build application from source
3. **prod-deps** - Generate production-only dependencies with `pnpm prune --prod`
4. **runtime** - Final production image with only necessary artifacts

### Current Image Sizes

- **Before optimization:** ~900MB per image
- **After optimization:** ~500MB per image
- **Size reduction:** ~45%

### Key Optimization Techniques

✅ Multi-stage builds (separate build and runtime)
✅ `pnpm prune --prod` (remove dev dependencies)
✅ Alpine Linux base image (150MB)
✅ Copy only production artifacts
✅ Health checks using Node.js (no external tools)

For detailed optimization information, see [DOCKER_OPTIMIZATION.md](../DOCKER_OPTIMIZATION.md)

## Dockerfile Features

### Common Features (All Microservices)

- **Base Image:** `node:20-alpine` (lightweight, ~150MB)
- **Package Manager:** `pnpm` with frozen lock file
- **Prisma Support:** Prisma client generation before build
- **Entrypoint:** Docker entrypoint script for migrations and startup
- **Environment:** NODE_ENV=production

### Gateway-Specific Features

- **Health Check:** Native HTTP check using Node.js
- **Exposed Port:** 3000
- **CMD:** `node dist/apps/gateway/main.js`

### Microservice-Specific Features

- **Health Check:** Via entrypoint script
- **Entrypoint:** `/entrypoint.sh` for database migrations
- **CMD:** ENTRYPOINT (runs entrypoint.sh)

## CI/CD Integration

The build and push scripts are automatically triggered by:
- `./.github/workflows/docker-build.yml` (GitHub Actions)
- Or manual execution: `pnpm run ci`

## Best Practices

1. **Always use specific base image versions** (not `latest`)
2. **Run `docker login` before pushing** images
3. **Use environment variables** for registry username and version
4. **Tag images with version numbers** for production deployments
5. **Test locally before pushing** to registry

Example workflow:
```bash
# 1. Build all images locally
./scripts/build-all-images.sh

# 2. Test an image
docker run -it your-registry/lv-gateway:latest

# 3. Login to registry
docker login

# 4. Push images
./scripts/push-all-images.sh

# 5. Deploy
docker pull your-registry/lv-gateway:latest
docker run your-registry/lv-gateway:latest
```

## Troubleshooting

### Build fails with "Module not found: './generated/client'"

**Solution:** Ensure Prisma client is generated before build. Already handled in optimized Dockerfiles:
```dockerfile
RUN pnpm exec prisma generate --schema=apps/app-name/prisma/schema.prisma
RUN pnpm build app-name
```

### Image size is still large

**Possible causes:**
1. Unoptimized node_modules (contains dev dependencies)
2. Old base image version
3. Unnecessary files copied to final stage

**Solution:** Verify `pnpm prune --prod` is executed in Stage 3

### Docker build fails on Windows

**Solution:** Use Git Bash or WSL2 instead of Command Prompt

```bash
# Good: Git Bash / WSL2
./scripts/build-all-images.sh

# Bad: Command Prompt (will fail)
cmd> .\scripts\build-all-images.sh
```

## References

- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [pnpm CLI Reference](https://pnpm.io/cli/prune)
- [Alpine Linux](https://alpinelinux.org/)

