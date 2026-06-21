# PES Engine — Deployment Guide

## Quick Start

### 1. Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** (optional, for containerized deployment)
- **Shopify Partner Account** with API credentials
- **Git** (for cloning and version control)

### 2. Environment Setup

```bash
# Clone the repository
git clone https://github.com/portlandiaelectric/pes-engine.git
cd pes-engine

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Required: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database with PES vendor data
npm run db:seed
```

### 5. Development Server

```bash
# Start development server with hot reload
npm run dev

# The app will be available at http://localhost:3000
# Use ngrok for Shopify tunneling: ngrok http 3000
```

### 6. Shopify App Setup

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Create a new app
3. Copy API key and secret to `.env`
4. Set app URL to your ngrok/public URL
5. Install app on your development store

---

## Docker Deployment

### Standard SQLite (Airgap-Ready)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f pes-engine

# Stop
docker compose down
```

### Enterprise (PostgreSQL + Redis)

```bash
# Start with enterprise profile
docker compose --profile enterprise up -d

# View all services
docker compose ps

# Scale app (if using Swarm or Compose v3+)
docker compose up -d --scale pes-engine=3
```

### Production with Nginx Reverse Proxy

```bash
# Start with production profile
docker compose --profile production up -d

# SSL certificates go in ./nginx/ssl/
# nginx/nginx.conf configured for PES Engine
```

---

## Shopify Theme Extensions

### Build Extensions

```bash
# Build all theme extensions
npm run extension:build
```

### Deploy Extensions

```bash
# Push extensions to Shopify
npm run extension:push

# Or deploy entire app including extensions
npm run shopify:app:deploy
```

### Extension Blocks

| Block | Description | Shopify Location |
|-------|-------------|-----------------|
| `eol-banner` | EOL notice banner | Product template |
| `comparison-table` | Old vs new comparison | Product template |
| `urgency-badges` | Inventory/price badges | Collection grid |
| `spec-sheet-button` | Download spec sheets | Product template |
| `cross-sell-carousel` | Replacement recommendations | Product template |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode |
| `AIRGAP_MODE` | Yes | `true` | Disable external APIs |
| `SHOPIFY_API_KEY` | Yes | — | Shopify app API key |
| `SHOPIFY_API_SECRET` | Yes | — | Shopify app secret |
| `SHOPIFY_APP_URL` | Yes | — | App public URL |
| `DATABASE_URL` | Yes | `file:./data/pes-engine.db` | Database connection |
| `DATABASE_PROVIDER` | Yes | `sqlite` | `sqlite` or `postgresql` |
| `JWT_SECRET` | Yes | — | JWT signing secret |
| `SESSION_SECRET` | Yes | — | Session encryption secret |
| `REDIS_URL` | No | — | Redis connection (enterprise) |
| `REDIS_ENABLED` | No | `false` | Enable Redis caching |
| `SMTP_HOST` | No | — | Email server (if enabled) |
| `SMTP_USER` | No | — | Email username |
| `SMTP_PASS` | No | — | Email password |
| `COMPETITOR_SCRAPING_ENABLED` | No | `false` | Enable competitor scraping |
| `LLM_GENERATION_ENABLED` | No | `false` | Enable AI content generation |
| `CRON_ENABLED` | No | `true` | Enable background jobs |
| `LOG_LEVEL` | No | `info` | Logging verbosity |
| `BACKUP_ENABLED` | No | `false` | Automated backups |

---

## Backup & Recovery

### Manual Backup (SQLite)

```bash
# Backup SQLite database
cp ./data/pes-engine.db ./data/backups/pes-engine-$(date +%Y%m%d).db

# Restore
cp ./data/backups/pes-engine-YYYYMMDD.db ./data/pes-engine.db
```

### Automated Backup (Enterprise)

```bash
# Start backup service
docker compose --profile backup up -d

# Backups saved to ./data/backups/
# Retention: 30 days (configurable)
```

### PostgreSQL Backup

```bash
# Dump database
docker exec pes-engine-postgres pg_dump -U pes pes_engine > backup.sql

# Restore
docker exec -i pes-engine-postgres psql -U pes pes_engine < backup.sql
```

---

## Updating

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Run migrations
npm run db:migrate

# Rebuild and restart
npm run build
npm start
```

---

## Troubleshooting

### Port 3000 Already in Use

```bash
# Find process
lsof -i :3000
# Kill it or change PORT in .env
```

### Database Locked (SQLite)

```bash
# Check for locks
ls -la ./data/
# Remove WAL files if safe
rm ./data/pes-engine.db-wal ./data/pes-engine.db-shm
```

### Shopify Auth Fails

1. Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` match Partners Dashboard
2. Ensure `SHOPIFY_APP_URL` is accessible from internet (use ngrok for dev)
3. Check redirect URLs match `shopify.app.toml`

### Extension Deploy Fails

```bash
# Rebuild extensions
npm run extension:build

# Push individually
shopify app extension push --extension eol-banner
shopify app extension push --extension comparison-table
```

---

## Production Checklist

- [ ] `.env` configured with production credentials
- [ ] `NODE_ENV=production`
- [ ] `AIRGAP_MODE=true` (if airgap required)
- [ ] Database backed up
- [ ] SSL certificates configured (if using Nginx)
- [ ] Shopify app installed and configured
- [ ] Theme extensions deployed
- [ ] Cron jobs enabled
- [ ] Monitoring/health checks active
- [ ] Audit logs enabled
- [ ] Multi-user RBAC configured (enterprise)

---

*Portlandia Electric Supply — PES Engine v1.0.0*
