/**
 * EOL Detection Engine — PES Engine
 * Detects end-of-life products from vendor data, pricebooks, and catalog signals
 */

import { prisma } from "../db.server";
import { normalizeText } from "../utils/string-utils.js";
import { parseDate } from "../utils/date-utils.js";

const EOL_KEYWORDS = [
  "DISCONTINUED", "OBSOLETE", "EOL", "END OF LIFE", "PHASED OUT",
  "REPLACED BY", "SUPERSEDED", "DISCONTINUED", "NO LONGER AVAILABLE",
  "LEGACY", "PREVIOUS GENERATION", "GEN 1", "V1", "OLD MODEL",
  "CLEARANCE", "CLOSEOUT", "FINAL STOCK", "LIMITED INVENTORY",
  "NOT FOR NEW INSTALLS", "SERVICE ONLY", "PARTS ONLY",
  "REPLACEMENT:", "NEWER MODEL:", "UPGRADE TO:", "SUCCESSOR:",
];

const EXITED_BRANDS = {
  "LG Solar": { exited: true, year: 2022, region: "Global" },
  "Panasonic Solar": { exited: true, year: 2023, region: "US Residential" },
};

const SUPERESSION_PATTERNS = {
  generac: [
    { regex: /^(\d{4,5})$/g, replacement: (m) => `20${m[1]}` },
    { regex: /V(\d)\.\d/g, replacement: (m) => `V${parseInt(m[1]) + 1}.0` },
    { regex: /Gen(\d)/g, replacement: (m) => `Gen${parseInt(m[1]) + 1}` },
  ],
  eg4: [
    { regex: /(\d+)kW/g, replacement: (m) => `${parseInt(m[1]) + 2}kW` },
    { regex: /V(\d)/g, replacement: (m) => `V${parseInt(m[1]) + 1}` },
  ],
  enphase: [
    { regex: /IQ(\d+)/g, replacement: (m) => `IQ${parseInt(m[1]) + 1}` },
  ],
  solaredge: [
    { regex: /SE(\d{4,5})/g, replacement: (m) => `SE${parseInt(m[1]) + 1000}` },
  ],
};

export function detectEOL(product) {
  const signals = [];
  const title = normalizeText(product.title || "");
  const description = normalizeText(product.description || "");
  const model = normalizeText(product.model || "");
  const sku = normalizeText(product.sku || "");

  // Keyword detection
  for (const keyword of EOL_KEYWORDS) {
    if (title.includes(keyword) || description.includes(keyword) || sku.includes(keyword)) {
      signals.push({ type: "keyword", keyword, source: "title/description/sku" });
    }
  }

  // Exited brand detection
  for (const [brand, info] of Object.entries(EXITED_BRANDS)) {
    if (title.includes(brand.toLowerCase()) || product.brand === brand) {
      signals.push({ type: "exited_brand", brand, ...info });
    }
  }

  // Model generation detection
  const vendorPatterns = SUPERESSION_PATTERNS[product.vendor?.code] || [];
  for (const pattern of vendorPatterns) {
    const matches = model.match(pattern.regex) || title.match(pattern.regex);
    if (matches) {
      signals.push({ type: "model_generation", pattern: pattern.regex.toString(), matches });
    }
  }

  // Pricebook status detection
  if (product.status === "DISCONTINUED" || product.status === "OBSOLETE") {
    signals.push({ type: "pricebook_status", status: product.status });
  }

  // Inventory-based detection
  if (product.inventory <= 0 && product.inventoryTracked) {
    signals.push({ type: "inventory", inventory: product.inventory, reason: "Zero inventory" });
  }

  // Date-based detection (products older than 5 years with no recent updates)
  const lastUpdated = product.lastUpdated ? new Date(product.lastUpdated) : null;
  if (lastUpdated && (Date.now() - lastUpdated.getTime()) > 5 * 365 * 24 * 60 * 60 * 1000) {
    signals.push({ type: "age", years: 5, lastUpdated });
  }

  // Vendor-specific EOL rules (from config/eol-rules/*.yml)
  if (product.vendor?.eolRules) {
    for (const rule of product.vendor.eolRules) {
      if (rule.matches(product)) {
        signals.push({ type: "vendor_rule", rule: rule.name, reason: rule.reason });
      }
    }
  }

  return {
    isEOL: signals.length > 0,
    confidence: Math.min(signals.length * 0.25, 1.0),
    signals,
    eolStrategy: determineEOLStrategy(signals, product),
  };
}

function determineEOLStrategy(signals, product) {
  // If exited brand → discontinued_reference
  if (signals.some(s => s.type === "exited_brand")) {
    return "discontinued_reference";
  }

  // If zero inventory + clearance keywords → liquidation
  if (signals.some(s => s.type === "keyword" && ["CLEARANCE", "CLOSEOUT", "FINAL STOCK"].includes(s.keyword))) {
    return "liquidation";
  }

  // If replacement found → legacy
  if (signals.some(s => s.type === "keyword" && ["REPLACED BY", "SUPERSEDED", "SUCCESSOR"].includes(s.keyword))) {
    return "legacy";
  }

  // If service only / parts only → discontinued_reference
  if (signals.some(s => s.type === "keyword" && ["SERVICE ONLY", "PARTS ONLY", "NOT FOR NEW INSTALLS"].includes(s.keyword))) {
    return "discontinued_reference";
  }

  // Default: legacy
  return "legacy";
}

export async function findReplacement(eolProduct) {
  // Check explicit EOL mapping table
  const explicitMapping = await prisma.eolMapping.findUnique({
    where: { oldSku: eolProduct.sku },
  });

  if (explicitMapping) {
    return await prisma.vendorProduct.findUnique({
      where: { sku: explicitMapping.newSku },
      include: { vendor: true },
    });
  }

  // Pattern-based matching
  const vendorPatterns = SUPERESSION_PATTERNS[eolProduct.vendor?.code];
  if (vendorPatterns) {
    for (const pattern of vendorPatterns) {
      const replacementModel = pattern.replacement(eolProduct.model);
      if (replacementModel) {
        const candidate = await prisma.vendorProduct.findFirst({
          where: { model: replacementModel, vendorId: eolProduct.vendorId },
        });
        if (candidate) return candidate;
      }
    }
  }

  // Category-based fuzzy matching
  const candidates = await prisma.vendorProduct.findMany({
    where: {
      category: eolProduct.category,
      vendorId: eolProduct.vendorId,
      lifecycle: "active",
    },
    take: 5,
  });

  // Sort by similarity to original model
  const scored = candidates.map(c => ({
    product: c,
    score: modelSimilarity(eolProduct.model, c.model),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.product || null;
}

function modelSimilarity(a, b) {
  if (!a || !b) return 0;
  const aNorm = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bNorm = b.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Simple Levenshtein-like distance
  const maxLen = Math.max(aNorm.length, bNorm.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(aNorm, bNorm);
  return 1 - distance / maxLen;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }

  return matrix[b.length][a.length];
}

export function generateEOLBanner(eolProduct, replacement = null) {
  const strategy = eolProduct.eolStrategy || "legacy";

  const banners = {
    liquidation: {
      color: "#d72c0d",
      bg: "#fff4f4",
      icon: "🏷️",
      title: "Clearance — Limited Stock",
      message: replacement
        ? `The ${eolProduct.model} is being liquidated. Replacement: ${replacement.model}.`
        : `The ${eolProduct.model} is on clearance. Limited stock available.`,
    },
    legacy: {
      color: "#bf7500",
      bg: "#fff5ea",
      icon: "📦",
      title: "Legacy Product — Replacement Available",
      message: replacement
        ? `The ${eolProduct.model} is a legacy product. We recommend the ${replacement.model} as the current replacement.`
        : `The ${eolProduct.model} is a legacy product. Contact us for replacement options.`,
    },
    discontinued_reference: {
      color: "#5c5f62",
      bg: "#f6f6f7",
      icon: "ℹ️",
      title: "Discontinued — For Reference Only",
      message: `The ${eolProduct.model} has been discontinued. This page is for reference only.`,
    },
    clearance: {
      color: "#d72c0d",
      bg: "#fff4f4",
      icon: "🏷️",
      title: "Clearance Pricing",
      message: `The ${eolProduct.model} is on clearance. Final sale — no returns.`,
    },
  };

  const banner = banners[strategy] || banners.legacy;

  return {
    html: `<div class="pes-eol-banner pes-eol-${strategy}" style="background:${banner.bg};border:1px solid ${banner.color};padding:16px;border-radius:8px;margin:16px 0;">
  <div style="display:flex;align-items:center;gap:12px;">
    <span style="font-size:24px;">${banner.icon}</span>
    <div>
      <div style="font-weight:600;color:${banner.color};font-size:16px;">${banner.title}</div>
      <div style="color:#5c5f62;font-size:14px;margin-top:4px;">${banner.message}</div>
    </div>
  </div>
</div>`,
    css: `.pes-eol-banner { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }`,
    ...banner,
  };
}

export function generateComparisonTable(oldProduct, newProduct) {
  const attributes = [
    { label: "Model", oldKey: "model", newKey: "model" },
    { label: "Wattage", oldKey: "wattage", newKey: "wattage" },
    { label: "Voltage", oldKey: "voltage", newKey: "voltage" },
    { label: "Efficiency", oldKey: "efficiency", newKey: "efficiency" },
    { label: "Warranty", oldKey: "warranty", newKey: "warranty" },
    { label: "Price", oldKey: "price", newKey: "price" },
  ];

  const rows = attributes.map(attr => {
    const oldVal = oldProduct[attr.oldKey];
    const newVal = newProduct[attr.newKey];
    const improved = oldVal && newVal && (parseFloat(newVal) > parseFloat(oldVal));

    return {
      attribute: attr.label,
      oldValue: oldVal || "—",
      newValue: newVal || "—",
      improved,
    };
  });

  return {
    html: `<div class="pes-comparison-table" style="margin:16px 0;">
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#f6f6f7;">
        <th style="padding:12px;text-align:left;border:1px solid #ddd;font-weight:600;">Attribute</th>
        <th style="padding:12px;text-align:left;border:1px solid #ddd;font-weight:600;color:#d72c0d;">${oldProduct.model}</th>
        <th style="padding:12px;text-align:left;border:1px solid #ddd;font-weight:600;color:#008060;">${newProduct.model}</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `<tr>
        <td style="padding:12px;border:1px solid #ddd;">${r.attribute}</td>
        <td style="padding:12px;border:1px solid #ddd;">${r.oldValue}</td>
        <td style="padding:12px;border:1px solid #ddd;${r.improved ? 'background:#e3f1df;font-weight:600;' : ''}">${r.newValue}${r.improved ? ' ↑' : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`,
    rows,
  };
}

export async function runEOLDetectionScan() {
  const products = await prisma.vendorProduct.findMany({
    where: { lifecycle: "active" },
    include: { vendor: true },
  });

  const results = [];

  for (const product of products) {
    const detection = detectEOL(product);

    if (detection.isEOL) {
      const replacement = await findReplacement(product);

      await prisma.vendorProduct.update({
        where: { id: product.id },
        data: {
          lifecycle: detection.eolStrategy === "liquidation" ? "liquidation" : "legacy",
          eolDetectedAt: new Date(),
          eolStrategy: detection.eolStrategy,
          replacementId: replacement?.id || null,
          replacementConfidence: detection.confidence,
        },
      });

      const banner = generateEOLBanner(product, replacement);

      await prisma.shopifyProduct.updateMany({
        where: { sku: product.sku },
        data: {
          lifecycle: detection.eolStrategy === "liquidation" ? "liquidation" : "legacy",
          htmlBanner: banner.html,
        },
      });

      results.push({
        sku: product.sku,
        title: product.title || product.model,
        strategy: detection.eolStrategy,
        confidence: detection.confidence,
        signals: detection.signals,
        replacement: replacement ? { sku: replacement.sku, model: replacement.model } : null,
      });
    }
  }

  return {
    scanned: products.length,
    detected: results.length,
    results,
  };
}

export { EOL_KEYWORDS, EXITED_BRANDS, SUPERESSION_PATTERNS };
