# Multi-stage Dockerfile for PES Engine
# Supports: development, production, airgap

# ───────────────────────────────────────
# Stage 1: Base
# ───────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    bash \
    curl \
    ca-certificates \
    tzdata

ENV TZ=UTC

# ───────────────────────────────────────
# Stage 2: Dependencies
# ───────────────────────────────────────
FROM base AS dependencies

COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Generate Prisma client
COPY prisma/ ./prisma/
RUN npx prisma generate

# ───────────────────────────────────────
# Stage 3: Build
# ───────────────────────────────────────
FROM dependencies AS build

COPY . .
RUN npm run build

# ───────────────────────────────────────
# Stage 4: Production
# ───────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production && npm cache clean --force

# Copy built assets and Prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/public ./public
COPY --from=build /app/build ./build
COPY --from=build /app/.env* ./

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/specs /app/data/logs /app/data/backups && \
    chown -R nodejs:nodejs /app

# Seed database if not exists (optional)
# RUN if [ ! -f /app/data/pes-engine.db ]; then npx prisma db seed; fi

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]

# ───────────────────────────────────────
# Stage 5: Airgap
# ───────────────────────────────────────
FROM production AS airgap

ENV AIRGAP_MODE=true

# Disable all external API calls
ENV COMPETITOR_SCRAPING_ENABLED=false
ENV MANUFACTURER_SPEC_FETCH_ENABLED=false
ENV EMAIL_SERVICE_ENABLED=false
ENV ANALYTICS_ENABLED=false
ENV LLM_GENERATION_ENABLED=false
ENV CLOUD_STORAGE_ENABLED=false

# Self-signed certificate support for local HTTPS
ENV SELF_SIGNED_CERT=true

# No external network dependencies beyond Shopify Admin API
# All vendor pricebooks must be file-uploaded
# All competitor data must be CSV-imported
# All spec sheets must be PDF-uploaded

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]
