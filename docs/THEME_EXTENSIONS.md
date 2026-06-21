# PES Engine — Theme Extensions Guide

## Overview

PES Engine includes 5 Shopify theme extension blocks that enhance the storefront with EOL messaging, comparison tables, urgency badges, spec sheets, and cross-sell recommendations.

## Installation

### 1. Build Extensions

```bash
npm run extension:build
```

### 2. Push to Shopify

```bash
npm run extension:push
```

### 3. Add Blocks in Theme Editor

1. Go to **Shopify Admin → Online Store → Themes → Customize**
2. Navigate to a product page template
3. Click **Add section** → search for PES Engine blocks
4. Drag and drop blocks into the desired position

---

## EOL Banner Block

**Block name:** `pes-engine/eol-banner`

Displays end-of-life notices on product pages based on `lifecycle.eol_strategy` metafield.

### Supported Strategies

| Strategy | Appearance | Message |
|----------|-----------|---------|
| `liquidation` | 🔥 Yellow/orange banner | "Limited Stock — Only X Left" |
| `clearance` | 🏷️ Blue banner | "Clearance Item — while supplies last" |
| `discontinued_reference` | ⚠️ Red banner | "Product Superseded — Newer Version Available" |
| `legacy` | 📋 Gray banner | "Legacy Product — special order only" |

### Required Metafields

```json
{
  "lifecycle": {
    "status": "eol",
    "eol_strategy": "discontinued_reference",
    "replacement_handle": "new-product-handle",
    "replacement_benefit": "Upgraded with 20% more power",
    "customer_message": "This product has been discontinued..."
  }
}
```

### Block Settings

- **Show on EOL products only**: Toggle to show/hide banner for non-EOL products
- **Banner Position**: Above title, below title, or above add-to-cart

### Example Liquid

```liquid
{% assign lifecycle = product.metafields.lifecycle.status %}
{% assign eol_strategy = product.metafields.lifecycle.eol_strategy %}
{% assign replacement_handle = product.metafields.lifecycle.replacement_handle %}

{% if lifecycle == 'eol' %}
  <div class="pes-eol-banner pes-eol-{{ eol_strategy }}">
    {% if eol_strategy == 'discontinued_reference' %}
      <h3>⚠️ Product Superseded</h3>
      <p>This model has been replaced by 
         <a href="/products/{{ replacement_handle }}">the newer version</a>.</p>
    {% endif %}
  </div>
{% endif %}
```

---

## Comparison Table Block

**Block name:** `pes-engine/comparison-table`

Shows side-by-side comparison of old vs. new product on EOL pages.

### Required Metafields

```json
{
  "lifecycle": {
    "comparison_json": [
      { "attribute": "Power Output", "oldValue": "18kW", "newValue": "22kW", "improved": true },
      { "attribute": "Warranty", "oldValue": "5 years", "newValue": "10 years", "improved": true }
    ]
  }
}
```

### Block Settings

- **Show on EOL products only**: Toggle visibility
- **Maximum rows**: Limit comparison rows (default 10)

### Features

- Green highlighting for improved features
- Strikethrough for discontinued specs
- "Why Upgrade" benefits section
- CTA button to replacement product

---

## Urgency Badges Block

**Block name:** `pes-engine/urgency-badges`

Injects badges on collection product cards and PDP.

### Badge Types

| Badge | Trigger | Color |
|-------|---------|-------|
| 🔥 Only X Left | EOL liquidation + inventory < 5 | Red |
| 🔥 Limited Stock | EOL liquidation + inventory > 5 | Orange |
| 🏷️ X% Off | EOL clearance + compare-at price set | Blue |
| 🏷️ Clearance | EOL clearance | Teal |
| ⚠️ Superseded | EOL discontinued_reference | Orange |
| 📋 Special Order | EOL legacy | Gray |
| Only X Left | Low inventory (non-EOL) | Yellow |
| X% Off | Discount > 15% (non-EOL) | Green |

### Block Settings

- **Show low inventory badge**: Toggle
- **Low inventory threshold**: Default 5 units
- **Show discount badge**: Toggle
- **Show EOL badges**: Toggle

### Usage

Add to collection page template to show on product cards:
```
Shopify Admin → Customize → Collection page → Add block → Urgency Badges
```

---

## Spec Sheet Button Block

**Block name:** `pes-engine/spec-sheet-button`

Displays download buttons for technical documentation on product pages.

### Supported Spec Types

| Type | Icon | Label |
|------|------|-------|
| Datasheet | 📄 | Data Sheet |
| Manual | 📖 | Installation Manual |
| Warranty | 🛡️ | Warranty |
| Installation | 🔧 | Installation Guide |
| Quick Start | ⚡ | Quick Start Guide |
| Certification | ✅ | Certification (NEMA/UL) |
| Brochure | 📋 | Product Brochure |

### Required Metafields

```json
{
  "specs": {
    "datasheet_url": "https://pes.example.com/specs/datasheet-123.pdf",
    "manual_url": "https://pes.example.com/specs/manual-123.pdf",
    "sheets_json": [
      { "type": "datasheet", "title": "Data Sheet", "url": "...", "isLocal": true }
    ]
  }
}
```

### Block Settings

- **Button style**: Outline, filled, or minimal
- **Open in new tab**: Toggle (default true)

---

## Cross-Sell Carousel Block

**Block name:** `pes-engine/cross-sell-carousel`

Shows recommended replacement or related products on EOL pages.

### Required Metafields

```json
{
  "lifecycle": {
    "replacement_handle": "new-product-handle"
  },
  "cross_sell": {
    "related_handles": ["related-1", "related-2", "related-3"]
  }
}
```

### Block Settings

- **Maximum products**: Default 4
- **Show replacement badge**: Toggle "Recommended" badge
- **Layout**: Grid, horizontal scroll, or stacked

### Features

- Primary card for replacement product with "Recommended" badge
- Secondary cards for related products
- Product images, titles, prices
- Hover effects and responsive grid
- Mobile-optimized layout

---

## Metafield Schema Setup

Create these metafield definitions in Shopify Admin:

### Lifecycle Namespace

```
Namespace: lifecycle
Key: status
Type: Single line text
Description: Product lifecycle status
```

```
Namespace: lifecycle
Key: eol_strategy
Type: Single line text
Description: EOL strategy type
```

```
Namespace: lifecycle
Key: replacement_handle
Type: Single line text
Description: Shopify handle of replacement product
```

```
Namespace: lifecycle
Key: replacement_benefit
Type: Multi-line text
Description: Benefits of upgrading to replacement
```

```
Namespace: lifecycle
Key: comparison_json
Type: JSON
Description: Comparison table data (old vs new)
```

### Specs Namespace

```
Namespace: specs
Key: datasheet_url
Type: URL
Description: Product datasheet URL
```

```
Namespace: specs
Key: manual_url
Type: URL
Description: Installation manual URL
```

```
Namespace: specs
Key: sheets_json
Type: JSON
Description: Array of spec sheets with type, title, URL
```

### Cross-Sell Namespace

```
Namespace: cross_sell
Key: related_handles
Type: JSON
Description: Array of related product handles
```

```
Namespace: cross_sell
Key: html_banner
Type: Multi-line text
Description: HTML banner content for EOL products
```

---

## CSS Customization

All blocks use prefixed CSS classes for easy styling:

```css
/* EOL Banner */
.pes-eol-banner { /* base styles */ }
.pes-eol-liquidation { /* liquidation theme */ }
.pes-eol-clearance { /* clearance theme */ }
.pes-eol-discontinued { /* discontinued theme */ }
.pes-eol-legacy { /* legacy theme */ }

/* Comparison Table */
.pes-comparison-table { /* table styles */ }
.pes-improved { /* improved row highlight */ }
.pes-col-new { /* new product column */ }

/* Urgency Badges */
.pes-badge { /* badge base */ }
.pes-badge-liquidation { /* red badge */ }
.pes-badge-clearance { /* blue badge */ }

/* Spec Sheets */
.pes-specs-wrapper { /* container */ }
.pes-spec-button { /* button styles */ }

/* Cross-Sell */
.pes-cross-sell-grid { /* grid layout */ }
.pes-cross-sell-card { /* card styles */ }
.pes-card-primary { /* replacement card highlight */ }
```

Add custom CSS to your theme's stylesheet or via Shopify's Custom CSS feature.

---

## Testing

1. Create a test product in Shopify
2. Set metafields via Shopify Admin or API
3. View product page in storefront
4. Verify blocks render correctly
5. Check mobile responsiveness

### Metafield Quick Test (Shopify GraphQL)

```graphql
mutation {
  productUpdate(
    input: {
      id: "gid://shopify/Product/123456789"
      metafields: [
        {
          namespace: "lifecycle"
          key: "status"
          value: "eol"
          type: "single_line_text_field"
        }
      ]
    }
  ) {
    product { id }
  }
}
```

---

*Portlandia Electric Supply — PES Engine Theme Extensions Guide v1.0.0*
