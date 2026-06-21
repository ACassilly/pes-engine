# PES Engine — API Reference

## Base URL

- Development: `http://localhost:3000/api`
- Production: `https://your-app-url.com/api`

All endpoints require Shopify admin authentication via `authenticate.admin()`.

## Authentication

API routes are protected by Shopify session middleware. Requests must come from:
1. Authenticated Shopify admin session (embedded app)
2. Valid Shopify API key/secret pair

## Endpoints

### Health

```http
GET /api/health
```

Returns application health status.

**Response:**
```json
{
  "status": "ok",
  "database": true,
  "shopify": true,
  "airgap": true
}
```

---

### Vendors

```http
GET /api/vendors
```

List all configured vendors with product/pricebook counts.

**Response:**
```json
{
  "vendors": [
    {
      "id": "clh...",
      "name": "Generac",
      "code": "generac",
      "contactName": "Jennifer Weiss",
      "products": 625,
      "pricebooks": 5
    }
  ]
}
```

```http
GET /api/vendors/:id
```

Get vendor details with recent pricebooks and products.

```http
POST /api/vendors/pricebook-upload
Content-Type: multipart/form-data
```

Upload vendor pricebook (PDF, Excel, CSV).

**Form Data:**
- `vendorId` (string): Vendor ID
- `file` (file): Pricebook file

**Response:**
```json
{
  "success": true,
  "pricebook": { ... },
  "parsed": 625,
  "created": 625,
  "errors": []
}
```

---

### EOL Engine

```http
GET /api/eol/mappings
```

List all active EOL mappings.

```http
POST /api/eol/detect
```

Run EOL detection scan on all vendor products.

**Response:**
```json
{
  "success": true,
  "results": {
    "scanned": 1200,
    "eolDetected": 45,
    "replacementsFound": 38,
    "updated": 45,
    "errors": []
  }
}
```

```http
POST /api/eol/apply
Content-Type: application/x-www-form-urlencoded
```

Apply EOL strategy to a specific product.

**Form Data:**
- `productId` (string): Vendor product ID
- `strategy` (string): `liquidation`, `clearance`, `discontinued_reference`, `legacy`
- `replacementId` (string, optional): Replacement product ID

**Response:**
```json
{
  "success": true,
  "productId": "clh...",
  "strategy": "discontinued_reference"
}
```

---

### Pricing

```http
GET /api/pricing/analysis?vendorId=:id
```

Run pricing analysis (MAP violations, margin checks, etc.).

**Query Parameters:**
- `vendorId` (string, optional): Filter by vendor

**Response:**
```json
{
  "analysis": {
    "total": 500,
    "mapViolations": 3,
    "lowMargin": 12,
    "veryLowMargin": 1,
    "zeroPrice": 0,
    "issues": [...]
  }
}
```

```http
POST /api/pricing/bulk-update
Content-Type: application/x-www-form-urlencoded
```

Generate batch price update recommendations.

**Form Data:**
- `issueId` (string, multiple): Health issue IDs to fix
- `strategy` (string): `map`, `msrp`, `cost_plus`

**Response:**
```json
{
  "success": true,
  "batchSize": 15,
  "updates": [
    {
      "shopifyProductId": "gid://shopify/Product/123456",
      "sku": "PART-123",
      "currentPrice": 99.99,
      "newPrice": 149.99,
      "reason": "map_violation"
    }
  ]
}
```

---

### Health

```http
GET /api/health/score
```

Get current catalog health score.

**Response:**
```json
{
  "healthScore": 87
}
```

```http
GET /api/health/issues?status=open
```

List health issues by status.

**Query Parameters:**
- `status` (string): `open`, `in_progress`, `fixed`, `ignored`

```http
POST /api/health/scan
```

Run full catalog health scan.

```http
POST /api/health/fix
Content-Type: application/x-www-form-urlencoded
```

Apply suggested fix for a health issue.

**Form Data:**
- `issueId` (string): Health issue ID

---

### Catalog

```http
GET /api/catalog/missing?vendorId=:id
```

Find products in vendor catalog but not in Shopify.

**Response:**
```json
{
  "result": {
    "missing": [...],
    "found": [...],
    "totalVendor": 625,
    "totalShopify": 580
  }
}
```

---

### Manufacturer Specs

```http
GET /api/manufacturers/specs?sku=:sku
```

Get spec sheets for a product by SKU.

```http
POST /api/manufacturers/specs
Content-Type: multipart/form-data
```

Upload a spec sheet.

**Form Data:**
- `vendorId` (string): Vendor ID
- `productSku` (string): Product SKU
- `specType` (string): `datasheet`, `manual`, `warranty`, `installation`, `quick_start`, `certification`, `brochure`
- `file` (file): PDF file

---

### Competitors

```http
GET /api/competitors
```

List competitors and product counts.

```http
POST /api/competitors/import
Content-Type: multipart/form-data
```

Import competitor data from CSV/Excel.

**Form Data:**
- `competitorId` (string): Competitor ID
- `file` (file): CSV/Excel file

---

### Reports

```http
GET /api/reports
```

List generated reports.

```http
POST /api/reports/generate
Content-Type: application/x-www-form-urlencoded
```

Generate a new report.

**Form Data:**
- `reportType` (string): `pricing_audit`, `catalog_health`, `competitor_gap`, `vendor_sync`, `eol_audit`, `margin_analysis`, `inventory_report`
- `format` (string): `json`, `csv`, `pdf`

**Response:**
```json
{
  "success": true,
  "report": { "id": "clh...", "name": "pricing_audit_2026-01-15" },
  "data": { ... }
}
```

---

### Shopify Sync

```http
POST /api/shopify/sync
```

Trigger Shopify product sync.

**Response:**
```json
{
  "success": true,
  "message": "Shopify sync triggered",
  "productsToSync": 100
}
```

---

### Dashboard

```http
GET /api/dashboard/summary
```

Get executive dashboard summary data.

**Response:**
```json
{
  "activeVendors": 8,
  "totalVendorProducts": 1200,
  "missingFromShopify": 45,
  "totalShopifyProducts": 580,
  "openHealthIssues": 23,
  "criticalIssues": 2,
  "activeEolMappings": 156,
  "activeCompetitors": 5
}
```

---

## Error Responses

All errors return JSON with `error` field:

```json
{
  "error": "Vendor not found: clh..."
}
```

HTTP status codes:
- `400` — Bad request (missing parameters)
- `401` — Unauthorized (not authenticated)
- `404` — Resource not found
- `500` — Server error

---

## Rate Limiting

Default: 100 requests per 15-minute window per IP.

Configure in `.env`:
```
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Data Types

### VendorProduct

```json
{
  "id": "string",
  "vendorId": "string",
  "sku": "string",
  "model": "string?",
  "title": "string?",
  "description": "string?",
  "category": "string?",
  "goldCost": "decimal?",
  "mapPrice": "decimal?",
  "msrp": "decimal?",
  "lifecycle": "active | legacy | clearance | liquidation | discontinued_reference",
  "eolStrategy": "string?",
  "replacementId": "string?",
  "replacementBenefit": "string?",
  "replacementConfidence": "high | medium | low | none",
  "htmlBanner": "string?",
  "shopifyProductId": "string?",
  "inShopify": "boolean"
}
```

### HealthIssue

```json
{
  "id": "string",
  "shopifyProductId": "string?",
  "issueType": "zero_price | broken_handle | uncategorized | missing_brand | missing_images | duplicate_sku | missing_metadata | pdp_404 | missing_spec | missing_description | wrong_category | missing_tags | map_violation | msrp_violation | orphaned_product",
  "severity": "critical | high | medium | low | info",
  "description": "string",
  "suggestedAction": "delete | draft | update_price | fix_handle | add_category | add_brand | add_image | merge_sku | add_metadata | add_spec | fix_eol | redirect | ignore",
  "status": "open | in_progress | fixed | ignored"
}
```

---

*Portlandia Electric Supply — PES Engine API Reference v1.0.0*
