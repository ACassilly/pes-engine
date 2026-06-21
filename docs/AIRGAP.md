# PES Engine — Airgap Mode Guide

## What is Airgap Mode?

Airgap mode disables all external API dependencies, making PES Engine suitable for:

- **Enterprise deployments** with strict network security policies
- **Government/utility facilities** requiring no external connectivity
- **Field operations** with limited or no internet access
- **Data sovereignty** compliance (no cloud data transmission)
- **Offline warehouses** with isolated inventory systems

## Airgap vs. Online Mode

| Feature | Airgap Mode | Online Mode |
|---------|-------------|-------------|
| Competitor scraping | ❌ Disabled | ✅ Enabled (optional) |
| Manufacturer spec fetch | ❌ Disabled | ✅ Enabled (optional) |
| Email services | ❌ Disabled | ✅ Enabled (optional) |
| LLM/AI generation | ❌ Disabled | ✅ Enabled (optional) |
| Analytics telemetry | ❌ Disabled | ✅ Enabled (optional) |
| Cloud storage | ❌ Disabled | ✅ Enabled (optional) |
| Shopify API | ✅ Required | ✅ Required |
| Local file processing | ✅ Full | ✅ Full |
| SQLite database | ✅ Default | ✅ Default |
| PostgreSQL | ✅ Optional | ✅ Optional |
| Theme extensions | ✅ Full | ✅ Full |

## Enabling Airgap Mode

### Method 1: Environment Variable

```bash
# In .env
AIRGAP_MODE=true
```

### Method 2: Docker Compose

```yaml
services:
  pes-engine:
    environment:
      - AIRGAP_MODE=true
```

### Method 3: Runtime

```bash
# Start with airgap flag
AIRGAP_MODE=true npm start
```

## Data Flow in Airgap Mode

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Vendor Pricebook│     │ Manufacturer    │     │ Competitor      │
│ (PDF/Excel/CSV) │     │ Spec Sheets     │     │ Data (CSV)      │
│ File Upload     │     │ (PDF Upload)    │     │ (Manual Import) │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PES Engine (Local Processing)                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ Vendor    │  │ EOL       │  │ Pricing   │  │ Catalog   │   │
│  │ Parser    │  │ Detector  │  │ Engine    │  │ Health    │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ Spec      │  │ Competitor│  │ Shopify   │  │ Reports   │   │
│  │ Linker    │  │ Intel     │  │ Sync      │  │ Engine    │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│                           │                                      │
│                    ┌──────┴──────┐                              │
│                    │ SQLite/Postgre│                              │
│                    │ SQL Database  │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Shopify API     │
                    │ (Store Sync)    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Theme Extensions│
                    │ (Storefront)    │
                    └─────────────────┘
```

## Vendor Data Import (Airgap)

### 1. Obtain Pricebook Files

Download from vendor portals manually:
- Generac WHS Gold (Excel/PDF)
- Cummins ATS/Genset (PDF)
- EG4 Dealer Price List (Excel)
- Enphase Partner Price List (Excel)
- SolarEdge Monitoring Portal (Excel)

### 2. Upload via Admin UI

Navigate to **Vendor Catalog Sync → Upload** and drag-and-drop files.

### 3. Batch Import via CLI

```bash
# Place files in ./data/uploads/
# Then run seed script
npm run db:seed
```

### 4. Manual CSV Import

Format vendor data as CSV with columns:
```csv
sku,model,description,gold_cost,map_price,msrp,category
PART-123,Model Name,Description,100.00,150.00,200.00,Generators
```

Upload via the API endpoint or admin UI.

## Spec Sheet Management (Airgap)

### Upload Local PDFs

```bash
# Create spec directory
mkdir -p ./data/specs/generac
mkdir -p ./data/specs/cummins
mkdir -p ./data/specs/eg4

# Copy spec sheets
cp /path/to/generac-5871-0-datasheet.pdf ./data/specs/generac/
cp /path/to/cummins-rs20-manual.pdf ./data/specs/cummins/

# Import via admin UI or API
```

### Link Specs to Products

In the admin UI, navigate to **Manufacturer Specs → Upload** and:
1. Select vendor
2. Enter product SKU
3. Choose spec type (datasheet, manual, warranty, etc.)
4. Upload PDF file

## Competitor Data (Airgap)

### Manual CSV Import

Since web scraping is disabled, manually compile competitor data:

```csv
competitor,sku,title,price,compare_at_price,availability,url,brand,category
a1solarstore,PART-123,Product Title,199.99,249.99,in_stock,https://...,Brand,Category
```

Upload via **Competitor Intelligence → Import**.

### Periodic Manual Updates

1. Visit competitor sites manually
2. Export product data to CSV
3. Import into PES Engine
4. Run gap analysis and pricing comparison

## Cron Jobs (Airgap)

Background jobs run via `node-cron` locally:

| Job | Schedule | Airgap Behavior |
|-----|----------|-----------------|
| Vendor Sync | Weekly (Monday 2am) | Processes local files only |
| EOL Scan | Daily (3am) | Local detection only |
| Health Scan | Daily (4am) | Local analysis only |
| Competitor Monitor | Weekly (Monday 5am) | Disabled (no scraping) |
| Report Generation | Monthly (1st, 6am) | Local reports only |

All schedules are configurable in `.env` or admin settings.

## Security Considerations

### Self-Signed Certificates

For HTTPS in airgap environments:

```bash
# Generate self-signed cert
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./nginx/ssl/pes-engine.key \
  -out ./nginx/ssl/pes-engine.crt

# Update nginx config to use cert
```

### No Telemetry

Airgap mode guarantees:
- No analytics data sent to external services
- No error reporting to third parties
- No automatic updates or version checks
- No cloud-based feature flags
- No external CDN dependencies (all assets bundled locally)

### Audit Trail

All actions are logged locally in the database:
- Price changes
- EOL strategy applications
- Vendor imports
- Health issue fixes
- Spec uploads
- User logins

Access via **Admin Dashboard → Audit Log** or query `AuditLog` table.

## Offline Mode (Extreme Airgap)

For environments with zero external connectivity (no Shopify API):

1. Export data from online instance as CSV/Excel
2. Transfer via secure media (USB, SD card, secure file transfer)
3. Import into offline PES Engine instance
4. Process and generate output files
5. Export Shopify CSV for manual import

```bash
# Export vendor products to Shopify CSV
node scripts/export-shopify-csv.js

# Output: ./data/exports/pes-shopify-import.csv
# Import this into Shopify via Admin → Products → Import
```

## Enterprise Multi-User

Airgap mode supports multi-user access with local authentication:

- **Admin**: Full access
- **Pricing Manager**: Pricing rules, bulk updates
- **Content Manager**: EOL banners, spec sheets, descriptions
- **Viewer**: Read-only access to reports and dashboards
- **Vendor Manager**: Pricebook uploads, vendor contacts
- **Health Manager**: Health scans, issue fixes

No external SSO required. Local username/password or LDAP integration.

## Troubleshooting Airgap

### "External API disabled" error

Normal behavior. The feature requires online mode. Check `AIRGAP_MODE` in `.env`.

### Spec sheets not displaying on storefront

Verify:
1. Spec uploaded successfully in admin UI
2. Product SKU matches exactly (case-insensitive)
3. Shopify metafields synced (run sync from admin)
4. Theme extension deployed

### Competitor data stale

In airgap mode, competitor data must be manually imported. Set a calendar reminder for periodic updates.

### Database locked in Docker

Ensure volume is mounted correctly:
```yaml
volumes:
  - pes-data:/app/data
```

Do not use bind mounts on network drives for SQLite.

---

*Portlandia Electric Supply — PES Engine Airgap Guide v1.0.0*
