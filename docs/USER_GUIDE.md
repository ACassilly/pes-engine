# PES Engine — User Guide

## Getting Started

### Login

1. Navigate to your Shopify admin panel
2. Go to **Apps → PES Engine**
3. The app will authenticate automatically via Shopify OAuth

### Dashboard Overview

The main dashboard shows:
- **Vendor Catalogs**: Active vendors and tracked products
- **Shopify Products**: Products currently in your Shopify store
- **Missing Products**: Vendor catalog items not yet in Shopify
- **Health Score**: Overall catalog health (0–100)
- **EOL Products**: Products flagged as end-of-life
- **Competitors**: Tracked competitor catalogs

## Module Guide

### 1. Vendor Catalog Sync

**Purpose:** Upload and parse vendor pricebooks (PDF, Excel, CSV) to update your product catalog.

**How to use:**
1. Go to **Vendor Catalog Sync**
2. Select a vendor from the dropdown (e.g., Generac, Cummins, EG4)
3. Drag and drop or select a pricebook file
4. Click **Upload Pricebook**
5. The system will auto-parse SKUs, costs, MAP, MSRP, and descriptions
6. Review parsed products and approve for Shopify import

**Supported formats:**
- `.pdf` — Vendor price sheets (Generac WHS Gold, Cummins ATS/Genset)
- `.xlsx` / `.xls` — Excel pricebooks
- `.csv` — Comma-separated price lists

**Auto-detected vendors:**
The system attempts to detect the vendor from the filename and headers. If auto-detection fails, select the vendor manually.

### 2. EOL Engine

**Purpose:** Detect end-of-life products, map replacements, and generate storefront banners.

**How to use:**
1. Go to **EOL Engine**
2. Click **Detect EOL Products** to run an automatic scan
3. Review detected EOL products in the **Products** tab
4. Review and edit EOL mappings in the **Mappings** tab
5. Apply strategies:
   - **Liquidation** — Clear remaining stock at reduced price
   - **Clearance** — Special pricing while supplies last
   - **Discontinued Reference** — Route to newer replacement model
   - **Legacy** — Special order only, no replacement available

**Storefront impact:**
- EOL banners automatically appear on product pages via theme extension
- Comparison tables show old vs. new specs
- Urgency badges highlight limited inventory
- Cross-sell carousels recommend replacements

### 3. Pricing & MAP Engine

**Purpose:** Ensure pricing compliance with MAP/MSRP and optimize margins.

**How to use:**
1. Go to **Pricing & MAP Engine**
2. Click **Run Analysis** to scan all products
3. Review issues:
   - **MAP Violations** — Products priced below MAP (critical)
   - **Low Margin** — Products with <10% margin (high)
   - **Zero Price** — Products at $0.01 (critical)
   - **MSRP Exceeded** — Price above MSRP (medium)
4. Select issues and click **Bulk Update** to apply recommended prices

**Pricing strategies:**
- **MAP** — Sell at Minimum Advertised Price
- **MSRP** — Sell at Manufacturer's Suggested Retail Price
- **Cost Plus** — Cost + 15% margin
- **Liquidation** — Cost + 5% (clearance)

### 4. Catalog Health Monitor

**Purpose:** Detect and fix catalog issues: $0.01 products, missing brands, uncategorized items, broken handles, 404s, missing images, etc.

**How to use:**
1. Go to **Catalog Health Monitor**
2. Click **Run Health Scan** to check all 12 health categories
3. Review issues in the **Issues** tab
4. Click **Fix** on individual issues or select multiple for batch fixes

**Health checks:**
- Zero Price Detection
- Broken Handle Detection
- Uncategorized Products
- Missing Brand Attribution
- Missing Images
- Duplicate SKUs
- Missing SEO Metadata
- Missing Compare-At Price
- PDP 404 Detection
- Wrong Category Assignment
- Missing Tags
- Orphaned Products

**Health Score:**
- 90–100 = Excellent
- 75–89 = Good
- 50–74 = Fair
- 25–49 = Poor
- 0–24 = Critical

### 5. Manufacturer Spec Linker

**Purpose:** Upload and link spec sheets, manuals, and warranties to products.

**How to use:**
1. Go to **Manufacturer Specs**
2. Select vendor and enter product SKU
3. Choose spec type (datasheet, manual, warranty, installation, certification, brochure)
4. Upload PDF file
5. The spec will automatically link to the product via Shopify metafields
6. Customers see **Download Spec Sheet** buttons on product pages

**Supported spec types:**
- Data Sheet / Spec Sheet
- Installation Manual
- Warranty Document
- Installation Guide
- Quick Start Guide
- Certification (NEMA/UL)
- Product Brochure

### 6. Competitor Intelligence

**Purpose:** Track competitor products, pricing, and identify gaps in your catalog.

**How to use (Airgap mode):**
1. Go to **Competitor Intelligence**
2. Click **Import Data** on a competitor
3. Upload a CSV or Excel file with competitor products
4. View comparisons in the **Pricing** tab
5. Review gaps in the **Gaps** tab — products competitors sell that you don't

**CSV format for import:**
```csv
sku,title,price,compare_at_price,availability,url,brand,category
PART-123,Product Title,199.99,249.99,in_stock,https://...,Brand,Category
```

### 7. Theme Extensions

**Purpose:** Deploy storefront blocks for EOL messaging, badges, spec sheets, and cross-sell.

**How to use:**
1. Go to **Theme Extensions**
2. Click **Enable** on desired blocks
3. Click **Deploy** to push to Shopify
4. In Shopify Theme Editor, add PES Engine blocks to product pages

**Available blocks:**
- **EOL Banner** — Displays EOL notices on product pages
- **Comparison Table** — Side-by-side old vs. new product specs
- **Urgency Badges** — Inventory and price badges on collection cards
- **Spec Sheet Button** — Download spec sheets on product pages
- **Cross-Sell Carousel** — Recommended replacements and related products

**Block settings:**
Each block has configurable settings (position, style, thresholds) via the Shopify Theme Editor.

### 8. Reports & Analytics

**Purpose:** Generate and export pricing audits, health reports, and competitor analyses.

**How to use:**
1. Go to **Reports & Analytics**
2. Click **Generate Report**
3. Select report type (Pricing Audit, Catalog Health, Competitor Gap, etc.)
4. Choose format (JSON, CSV, PDF)
5. Download generated report

**Report types:**
- Pricing Audit — MAP violations, margin analysis, recommendations
- Catalog Health — Full health scan results and trend analysis
- Competitor Gap — Products competitors sell that you don't
- Vendor Sync — Pricebook import summary and delta analysis
- EOL Audit — EOL product inventory and replacement status
- Margin Analysis — Category and vendor margin breakdown

### 9. Settings

**Purpose:** Configure app behavior, airgap mode, cron schedules, and pricing rules.

**How to use:**
1. Go to **Settings**
2. View current configuration in **General**, **Airgap**, **Pricing**, and **Cron** tabs
3. Edit `.env` file directly for advanced configuration (restart required)

**Key settings:**
- **Airgap Mode** — Disable external APIs (competitor scraping, email, etc.)
- **Default Pricing Strategy** — MAP, MSRP, or Cost Plus
- **MAP Violation Threshold** — Alert when price is X% below MAP
- **Cron Schedules** — Background job timing (vendor sync, EOL scan, health scan)

## Frequently Asked Questions

### Q: How do I add a new vendor?

A: Edit `config/vendors/{vendor-code}.json` to add vendor configuration, then restart the app. The vendor will appear in the dropdown.

### Q: How do I handle MAP violations?

A: In the Pricing & MAP Engine, run an analysis, select MAP violations, and click **Bulk Update**. The system will recommend prices at or above MAP.

### Q: How do I update a competitor's pricing?

A: In Airgap mode, export competitor products to CSV from their website, then import via **Competitor Intelligence → Import Data**. In Online mode, enable scraping in Settings.

### Q: How do I fix a product with a 404 page?

A: Run the Catalog Health Monitor, find the PDP 404 issue, and apply the suggested fix (update handle or create redirect).

### Q: How do I add spec sheets to products?

A: Go to **Manufacturer Specs**, select the vendor, enter the SKU, choose the spec type, and upload the PDF. The spec sheet will appear on the product page via the **Spec Sheet Button** theme block.

### Q: How do I change the EOL strategy for a product?

A: Go to **EOL Engine → Products**, find the product, click **Edit**, and select the desired strategy (Liquidation, Clearance, Discontinued Reference, Legacy).

### Q: How do I deploy theme extensions?

A: Go to **Theme Extensions**, enable desired blocks, and click **Deploy**. Then in the Shopify Theme Editor, add PES Engine blocks to your product templates.

### Q: What happens in Airgap mode?

A: All external APIs (competitor scraping, manufacturer spec fetching, email, analytics) are disabled. All processing happens locally. File uploads and Shopify API are still available.

### Q: How do I back up the database?

A: Run `./scripts/backup.sh` or use the Docker backup service. Backups are saved to `./data/backups/`.

### Q: How do I upgrade to PostgreSQL/Enterprise?

A: Update `DATABASE_URL` in `.env` to a PostgreSQL connection string, set `DATABASE_PROVIDER=postgresql`, and restart. Use Docker Compose with `--profile enterprise` for full stack.

---

*Portlandia Electric Supply — PES Engine User Guide v1.0.0*
