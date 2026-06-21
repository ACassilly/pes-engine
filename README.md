# PES Engine — Unified Shopify App for Portlandia Electric Supply

> Built in **"Riven fashion"** — take battle-tested OSS, strip it, add PES modules, reship.

## What This Replaces

| Scattered Tool | What You Did | Replaced By |
|---|---|---|
| Manual Matrixify CSVs | Hand-crafted vendor pricebook imports, one vendor at a time, with field mapping nightmares | **Vendor Catalog Sync** — auto-detect any vendor format (PDF, Excel, CSV), map to Shopify products, batch sync with version history |
| EOL documents & email threads | Google Docs, vendor emails, Jaime/Jennifer/Spencer messages — all scattered, no single source of truth | **EOL Detection Engine** — auto-detect from PDF pricebook keywords, supersession mapping, model-gen matching, HTML banner generation for storefront |
| Python competitor scrapers | Fragile scripts that broke when Amazon/Signature Solar changed their HTML, no comparison matrix | **Competitor Intelligence** — manual CSV import (airgap-safe), gap analysis, side-by-side price comparison, category-specific monitoring |
| Broken manufacturer spec linking | Manual hunting for PDFs on Generac, EG4, Fronius websites, copy-pasting links into metafields | **Manufacturer Spec Linker** — drag-and-drop PDF upload, auto-extraction, direct link to Shopify metafields, version tracking |
| Manual price checking | $0.01 products, 404s, hidden collections, duplicate SKUs — found by customer complaint, not by system | **Catalog Health Monitor** — 12 health checks, zero-price detector, broken handle finder, uncategorized products, duplicate SKU, metadata completeness, 404 monitoring, health score (0-100) |
| Manual margin calculations | Spreadsheet models, MAP policy checks, MSRP enforcement — one product at a time, copy-pasted from Shopify | **Pricing Engine** — MAP/MSRP validation, cost-plus margin calculator, unit pricing ($/W, $/kWh, $/kW), recommended price generation, bulk update tools |
| Ad-hoc vendor contacts | Slack DMs, Gmail threads, random screenshots — no unified vendor database | **Vendor Directory** — contact card, portal links, status tracking, last synced at, product count |
| Theme gap (no EOL banners) | Products that were EOL displayed identically to current products, confusing customers, lost trust | **5 Theme App Extensions** — EOL banners, comparison tables, urgency badges, spec-sheet buttons, cross-sell carousels — all metafield-driven, responsive, Liquid-embedded |
| Manual reporting | Copy-paste from 5 different tools into one Word doc, for Anthony/Jennifer/Spencer review | **Report Engine** — pricing audit, EOL audit, health report, competitor gap, vendor sync — all in JSON or CSV, exportable |
| No Shopify theme integration | All fixes were backend-only, PDP looked identical whether product was EOL, legacy, or clearance | **Shopify Sync + Metafields** — bidirectional sync, metafield push (`lifecycle.*`, `specs.*`, `pricing.*`), Shopify Liquid blocks, theme-embedded |

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PES ENGINE v1.0.0                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │  VENDOR   │  │   EOL     │  │  PRICING  │  │  CATALOG  │  │
│  │  CATALOG  │  │ DETECTION │  │  ENGINE   │  │  HEALTH   │  │
│  │   SYNC    │  │  ENGINE   │  │           │  │  MONITOR  │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  │
│        │              │              │              │        │
│  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐  │
│  │MANUFACTURER│  │SHOPIFY   │  │COMPETITOR │  │  REPORT   │  │
│  │SPEC LINKER │  │  SYNC     │  │INTELLIGENCE│  │  ENGINE   │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  │
│        │              │              │              │        │
│  ┌─────▼─────────────▼──────────────▼──────────────▼─────┐  │
│  │                   PRISMA DATABASE                       │  │
│  │  SQLite (default) / PostgreSQL (enterprise)             │  │
│  └─────┬───────────────────────────────────────────────────┘  │
│        │                                                      │
│  ┌─────▼─────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │ 5 THEME   │  │  CRON/    │  │ NOTIFICATION│  │  AIRGAP   │  │
│  │EXTENSIONS │  │ SCHEDULER │  │  ENGINE     │  │  CONFIG   │  │
│  │(metafields)│  │           │  │             │  │           │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Modules

### A. Vendor Catalog Sync
- Auto-detect vendor from filename/headers (PDF/Excel/CSV)
- Supports: Generac, Cummins, EG4, Enphase, SolarEdge, SMA, Fronius, Sol-Ark, Victron, and generic fallback
- SKU normalization, unit-of-measure conversion (kW↔W, kWh↔Ah)
- Cross-reference with Shopify products, flag missing items
- Pricebook versioning with `effectiveDate` and `effectiveUntil`

### B. EOL Detection Engine
- Keyword detection ("DISCONTINUED", "OBSOLETE", "EOL", "PHASED OUT")
- Model generation matching (pre-2013 4-digit Generac, V1→V2, Gen1→Gen2, EG4 8kW→12kW, etc.)
- Exited brand detection (LG Solar exited 2022, Panasonic exited US residential 2023)
- Supersession mapping (auto-detect via regex + manual YAML rules)
- 4 EOL strategies: liquidation, clearance, legacy, discontinued_reference
- HTML banner generation with brand-safe CSS (`pes-*` prefix)
- Comparison table generation (old vs new model attributes)
- Shopify metafield push: `lifecycle.status`, `lifecycle.eol_strategy`, `lifecycle.replacement_handle`

### C. Pricing Engine
- MAP validation: flag if `shopifyPrice < mapPrice - $0.01`
- MSRP enforcement: flag if `shopifyPrice > msrp`
- Margin analysis: low margin (0-15%), very low (≤0%), high (≥50%)
- Unit pricing: $/W (panels), $/kWh (batteries), $/kW (inverters/generators)
- Recommended price: `map` strategy, `cost_plus` (default 15% margin), `clearance` (break-even), `liquidation` (below cost)
- Bulk price update tools with Shopify metafield push

### D. Catalog Health Monitor
- 12 health checks: zero-price, broken-handle, uncategorized, missing-brand, duplicate-sku, missing-images, missing-metadata, missing-compare-at, 404-PDP, wrong-category, missing-tags, orphaned-product
- Health score (0-100) with weighted severity
- Suggested action per issue type
- Fix application with audit logging
- Auto-fix capability (zero-price → suggested, missing-compare-at → auto-fill, missing-metadata → infer from vendor)
- 6,434 PES products at $0.01 — this module will catch and fix them all

### E. Manufacturer Spec Linker
- PDF upload (datasheets, manuals, warranties, install guides)
- Auto-extraction of metadata from filename/title
- Direct metafield push to Shopify: `specs.datasheet_url`, `specs.manual_url`, `specs.warranty_url`, `specs.sheets_json`
- Version tracking (replace older versions)
- Storefront "Download Spec Sheet" button via theme extension

### F. Competitor Intelligence
- Manual CSV import (airgap-safe — no external scraping)
- Gap analysis: products they have that PES doesn't
- Price comparison: PES vs competitors, MAP violation detection
- Category-specific monitoring (panels, inverters, batteries, generators)
- Competitor directory (display name, contact, website, pricing tiers)

### G. Shopify Sync
- Bidirectional sync: REST API read, metafield push
- Product create/update/delete webhook handlers
- Inventory level update webhook
- Metafield namespace: `lifecycle.*`, `specs.*`, `pricing.*`, `cross_sell.*`
- GraphQL client for advanced queries
- Bulk operations for large catalogs (6,434+ products)

### H. Theme App Extensions
- **eol-banner**: Full-width EOL banner on PDP, 3 variants (replacement, liquidation, legacy), responsive, mobile-safe
- **comparison-table**: Side-by-side old vs new model table, 6 attributes, reads from `lifecycle.comparison_json` metafield
- **urgency-badges**: Inventory-based urgency badges ("Only 3 left — clearance pricing!"), auto-positioned, tablet-safe
- **spec-sheet-button**: PDP button for datasheet download, linked to `specs.datasheet_url` metafield, responsive, mobile-safe
- **cross-sell-carousel**: Replacement product carousel on EOL PDP, 5 items, metafield-driven, responsive, mobile-first

All extensions use `pes-*` CSS prefix to avoid theme conflicts. All are metafield-driven (no hardcoded product data). All support mobile, tablet, desktop.

### I. Admin Dashboard (13 Polaris Routes)
- `/app` — Dashboard (health score, EOL count, MAP violations, competitor gaps, price action)
- `/app/vendors` — Vendor directory, pricebook upload, sync status
- `/app/eol` — EOL detection results, supersession mapping, apply to Shopify
- `/app/pricing` — Pricing issues, MAP violations, margin analysis, recommended prices
- `/app/health` — Health scan results, 12 checks, auto-fix, bulk fix
- `/app/catalog` — Missing products, catalog gap analysis, cross-reference
- `/app/manufacturers` — Spec sheet upload, link to metafields, version history
- `/app/competitors` — Competitor gap analysis, price comparison, CSV import
- `/app/reports` — Report generation, pricing audit, EOL audit, health report, CSV export
- `/app/extensions` — Theme extension status, deploy, preview, activate/deactivate
- `/app/settings` — App config, vendor defaults, pricing rules, API tokens, webhook config
- `/app/audit` — Full audit log with filtering by date, user, action type, status
- `/app/notifications` — In-app alerts for EOL detections, price alerts, health issues, system events

### J. Cron Scheduler + Notification Engine
- 5 background jobs: vendor sync (weekly), EOL scan (daily), health scan (daily), competitor monitor (weekly), report generation (monthly)
- In-app notification system: alerts, warnings, errors, success messages
- Actionable notifications with links to relevant dashboard modules
- Notification cleanup (90-day retention)

## Deployment Modes

### 1. Full Online (Shopify Cloud + AWS/GCP/Azure)
- **Use case**: Standard SaaS, external APIs, cloud storage, cloud analytics
- **Database**: PostgreSQL + Redis
- **Features**: All modules, all APIs, external competitor scraping, email notifications, cloud analytics
- **Constraints**: None
- **Docker**: `docker compose --profile enterprise up -d`

### 2. Hybrid (Shopify Cloud + Local Database)
- **Use case**: Self-hosted app, Shopify store on cloud, all data local
- **Database**: PostgreSQL or SQLite
- **Features**: All modules except cloud analytics
- **Constraints**: External APIs (competitor scraping, email) may be disabled
- **Docker**: `docker compose up -d`

### 3. Airgap (No Internet for App — Shop on Internet, App Completely Offline)
- **Use case**: Maximum security, all data local, no cloud dependencies
- **Database**: SQLite (default)
- **Features**: Vendor upload, spec upload, competitor CSV import, all engine modules, theme extensions, local reports
- **Constraints**: No external APIs (no scraping, no email, no cloud storage, no analytics phoning home, no CDN, no telemetry, no auto-updates). No LLM generation. No external spec fetching. Shopify API still available (store on Internet).
- **Docker**: `docker compose --profile airgap up -d` (uses `Dockerfile` `airgap` stage)
- **Airgap config**: `config/airgap.yml` — explicit feature flag matrix, external API availability, data flow rules, security settings, backup config

### 4. Offline (No Internet at All — Shop on Internet, App Completely Offline, No Shopify API)
- **Use case**: True airgap, no network at all
- **Database**: SQLite
- **Features**: All engine modules except Shopify sync. Manual data import/export via CSV. No metafield push. No webhook handling.
- **Constraints**: No Shopify API. No external APIs. No webhooks. No theme extension deployment. No CDN. All data import/export via file.
- **Use case**: Data preparation in secure environment, later sync to Shopify via manual CSV export

## Technology Stack

| Component | Technology | License | Reason |
|---|---|---|---|
| Framework | Shopify Remix App Template v3 | MIT | Battle-tested, Shopify-native, OAuth, webhooks, admin auth |
| UI | Polaris v12 | MIT | Shopify-native admin UI, data tables, cards, banners |
| Database | Prisma v5 + SQLite/PostgreSQL | Apache 2.0 | Type-safe ORM, auto-migrations, SQLite default, PostgreSQL enterprise |
| Tables | TanStack Table v8 | MIT | Sort, filter, pagination for 10K+ rows |
| Charts | Recharts | MIT | Health score, pricing trends, margin distribution |
| Forms | React Hook Form + Zod | MIT | Type-safe validation, form handling |
| State | TanStack Query | MIT | Server state caching, sync status, polling |
| Dates | date-fns | MIT | Timezone-safe, tree-shakeable |
| Parsing | xlsx | Apache 2.0 | Excel/CSV parsing for vendor pricebooks |
| PDF | pdf-lib | MIT | PDF parsing, spec sheet metadata |
| Scheduling | node-cron | MIT | Background jobs (vendor sync, EOL scan, health scan) |
| Icons | Heroicons | MIT | Consistent icon set |
| Build | Vite | MIT | Fast dev, optimized prod build |
| Docker | Docker + Docker Compose | — | Multi-stage: base, deps, build, production, airgap |
| Reverse Proxy | nginx | BSD | SSL termination, rate limiting, static asset caching |
| Backup | Alpine + cron | — | Daily SQLite/PostgreSQL backups, retention |

## Configuration

### Vendor Configs (`config/vendors/*.json`)
16 vendors: Generac, Cummins, EG4, Enphase, SolarEdge, SMA, Fronius, Sol-Ark, Victron, Jinko, Trina, Canadian Solar, REC, LG Solar, Panasonic, Q Cells

Each config includes: display name, SKU patterns, contact info, portal links, pricing tiers, product category matching, model generation keywords, attribute parsing rules, EOL detection flags, custom CSS selectors, unit-of-measure conversions, update frequency, notes.

### EOL Rules (`config/eol-rules/*.yml`)
14 rule sets: Generac, Cummins, EG4, Enphase, default, Fronius, Sol-Ark, Victron, Jinko, Trina, Canadian Solar, REC, LG Solar, Panasonic, Q Cells

Each rule set includes: 4 strategies (liquidation, clearance, discontinued_reference, legacy), inventory thresholds, date ranges, supersession regex patterns, exited brand flags, replacement recommendations, customer messaging templates, vendor contacts, competitor references, policy notes.

## Environment Variables

See `.env.example` for full configuration. Key sections:

- **Shopify**: API key, secret, app URL, admin access token, storefront token, API version
- **Database**: SQLite path (default) or PostgreSQL connection string
- **Authentication**: JWT secret, session secret, bcrypt rounds, rate limiting, CORS origins
- **Enterprise / SSO**: SAML 2.0, OIDC, LDAP configuration
- **File Storage**: Upload directory, max size, allowed MIME types
- **External APIs**: Enable/disable scraping, email, analytics, LLM, cloud storage (all disabled in airgap)
- **Cron**: 5 job schedules (vendor sync, EOL scan, health scan, competitor monitor, report generation)
- **Vendor Credentials**: Portal credentials for Generac WHS, Cummins Dealer, EG4, Enphase, SolarEdge Monitor
- **Pricing**: Default strategy, cost-plus margin, MAP threshold, batch size
- **Theme Extensions**: Dev store, theme ID
- **Logging**: Level, file path, rotation
- **Backup**: Schedule, retention days, path

## Key Contacts (for EOL / Pricing)

| Person | Vendor | Email | Role |
|---|---|---|---|
| Jaime Gilmore | Cummins | sales@cummins.com | US Sales Director |
| Anthony Dawood | EG4 | anthony.dawood@eg4.com | US Sales Lead |
| Jennifer Weiss | Generac | jennifer.weiss@generac.com | Regional Sales Manager |
| Spencer Warmuth | Generac | spencer.warmuth@generac.com | Strategic Account Manager |

## Known Data Issues (to be fixed by Health Monitor)

- **6,434 products at $0.01** — zero-price detector will catch and suggest recommended prices
- **"false" category** (13 items) — unknown category mapping
- **"UNKNOWN" brand** — missing brand field
- **Missing compare_at prices** — no MSRP displayed
- **Cummins Genset pricing outdated** — January 2026 sheet, need May 2026 update from Jaime Gilmore
- **EG4 12kPV** — listed at $3,999 (MAP $2,999.99) — MAP violation, price must be ≥$2,999.99

## MAP Policy Compliance

- **EG4**: Cannot advertise below MAP ($2,999.99 for 12kPV). Signature Solar prices at exactly MAP.
- **Generac**: Standard is to sell at MSRP for ~15.8% margin. Considerations for large orders but standard is at list price.
- **SMA**: Cannot sell below $1,350 for Sunny Boy Storage 5.8-10.
- All MAP violations are flagged by the Pricing Engine and displayed in the admin dashboard with severity = ERROR.

## Shopify Store Details

- **Store**: portlandiaelectricsupply.myshopify.com (Shop ID: 61351886)
- **Front-end**: https://www.portlandiaelectric.supply/
- **Admin**: https://admin.shopify.com/store/portlandiaelectricsupply
- **Products**: ~6,434 (with $0.01 pricing issue)
- **Matrixify**: Used for bulk imports/exports
- **Inventory By Location**: Not enabled for this shop
- **Market**: US market only, no international shipping

## Riven Commerce Integration

- **GitHub**: https://github.com/rivenai/riven-commerce
- **PES Sync Engine**: `rivenai/riven-commerce` contains `pes-supply-sync-engine.ts` which should be integrated into or replaced by this PES Engine
- **Pattern**: "Riven fashion" — strip battle-tested OSS, add PES modules, reship

## Development

```bash
# Clone
git clone https://github.com/ACassilly/pes-engine.git
cd pes-engine

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Shopify credentials

# Setup database
npx prisma migrate dev
npm run seed

# Dev mode
npm run dev

# Build for production
npm run build

# Docker
docker build -t pes-engine .
docker run -p 3000:3000 --env-file .env pes-engine

# Docker Compose (all services)
docker compose up --build

# Docker Compose (enterprise with PostgreSQL + Redis + nginx + backups)
docker compose --profile enterprise up -d
```

## Theme Extensions

```bash
# Deploy all extensions
npm run extension:deploy

# Dev mode with extensions
npm run extension:dev
```

## Documentation

- `docs/DEPLOYMENT.md` — Full deployment guide for all 4 modes
- `docs/AIRGAP.md` — Airgap configuration, security settings, feature matrix, data flow rules
- `docs/API.md` — Unified API endpoints, request/response schemas, authentication
- `docs/THEME_EXTENSIONS.md` — Extension deployment, Liquid blocks, metafield integration, mobile responsive design
- `docs/USER_GUIDE.md` — Getting started, vendor sync, EOL detection, pricing, health scan, competitor import, reports, settings, FAQ

## License

MIT — see LICENSE file for details.

## Roadmap

- [ ] Live Shopify sync testing (test against portlandiaelectricsupply.myshopify.com)
- [ ] Additional vendors: Growatt, SolaX, Tesla, Fortress Power, etc.
- [ ] Actual spec sheet PDF integration (test with Generac datasheets)
- [ ] Shopify CLI extension deployment (test with current theme)
- [ ] Cummins May 2026 pricebook update from Jaime Gilmore
- [ ] Competitor CSV import from Signature Solar, Solar Sovereign, etc.
- [ ] Health Monitor auto-fix: batch apply zero-price fixes, missing metadata fixes
- [ ] Email notifications (when enabled in online mode)
- [ ] LLM-generated customer messaging (when enabled in online mode)
- [ ] Advanced analytics dashboard (health score trends, margin distribution over time)
- [ ] Multi-user RBAC (enterprise mode)
- [ ] SSO integration (SAML 2.0, OIDC, LDAP)
- [ ] Automated backup rotation (enterprise mode)
- [ ] Mobile admin app (responsive PWA)
- [ ] Integration with Riven Commerce (https://github.com/rivenai/riven-commerce)

## Built By

**Portlandia Electric Supply (PES)**
- Web: https://www.portlandiaelectric.supply/
- Store: portlandiaelectricsupply.myshopify.com
- Email: webmaster@portlandiaelectric.supply
