# ⚠️ DEPRECATED — DO NOT USE

**This repository has been moved and is no longer maintained.**

The PES Engine has been restructured and migrated to the canonical Riven Commerce monorepo:

**New location:** `rivenai/riven-commerce` → `packages/apps/shopify-bridge/`  
**Branch:** `feat/shopify-bridge`

## Migration Details

- **Old repo:** `ACassilly/pes-engine` (this repo) — archived for historical reference only
- **New repo:** `rivenai/riven-commerce` (canonical)
- **New package name:** `@riven/shopify-bridge`
- **Status:** All active development continues on the new branch

## Why This Changed

As per PES/Riven architecture policy:
- PES (Portlandia Electric Supply) and other tenants are **clients** of Riven Commerce
- All shared infrastructure, tooling, and platform code lives under `rivenai/riven-commerce`
- Tenant-specific code is nested within the monorepo under `tenants/{tenant}/`
- The Shopify Bridge is a shared application, not a tenant-specific tool

## What Was Moved

All code, configs, and schemas have been migrated:
- Prisma schema (20+ models)
- 7 engine modules (vendor-parser, eol-detector, pricing-engine, shopify-sync, catalog-health, manufacturer-specs, competitor-intel)
- Riven service integration stubs (catalog, pricing, ERP, auth)
- Admin routes (Remix + Polaris)
- Theme extensions (EOL banners, comparison tables, spec sheets, cross-sell, urgency badges)
- Vendor configs (40+ manufacturers)
- EOL rules (YAML configs)
- Utilities, seed, scheduler, report engine

## For Contributors

Please direct all PRs and issues to: `https://github.com/rivenai/riven-commerce/tree/feat/shopify-bridge`

---

*This repo is archived for historical reference only. No further updates will be made.*
