# Multi-stage build for Gateway - OPTIMIZED
# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Stage 2: Builder
FROM deps AS builder

COPY . .

RUN pnpm build gateway

# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-deps

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules

RUN npm install -g pnpm && pnpm prune --prod

# Stage 4: Production runtime (OPTIMIZED)
FROM node:20-alpine

WORKDIR /app

# Set production environment early
ENV NODE_ENV=production

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Health check with node instead of wget (smaller, no external tools needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Expose HTTP port
EXPOSE 3000

# Run gateway
CMD ["node", "dist/apps/gateway/main.js"]

