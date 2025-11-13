# Dockerfile for ar-app microservice - OPTIMIZED
# Includes: Augmented Reality features, AR product visualization

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Stage 2: Builder (with Prisma generation)
FROM deps AS builder

COPY . .

# Generate Prisma client BEFORE build (required dependencies)
RUN pnpm exec prisma generate --schema=apps/ar-app/prisma/schema.prisma

# Build after Prisma client ready
RUN pnpm build ar-app

# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules

RUN npm install -g pnpm && pnpm prune --prod

# Stage 4: Production runtime (OPTIMIZED)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV APP_NAME=ar-app

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/ar-app/prisma ./apps/ar-app/prisma
COPY --from=builder /app/package.json ./
COPY scripts/docker-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

