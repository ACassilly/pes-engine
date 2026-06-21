/**
 * Pricing Engine — PES Engine
 * Validates MAP compliance, margin targets, unit pricing, and generates recommended prices
 */

import { prisma } from "../db.server";

const DEFAULT_COST_PLUS_MARGIN = 0.15; // 15%
const LOW_MARGIN_THRESHOLD = 0.15; // 15%
const HIGH_MARGIN_THRESHOLD = 0.50; // 50%

export function validatePricing(product) {
  const issues = [];

  // MAP violation
  if (product.mapPrice && product.shopifyPrice < product.mapPrice - 0.01) {
    issues.push({
      type: "map_violation",
      severity: "error",
      currentPrice: product.shopifyPrice,
      requiredPrice: product.mapPrice,
      message: `Price $${product.shopifyPrice} is below MAP $${product.mapPrice}`,
    });
  }

  // MSRP exceeded
  if (product.msrp && product.shopifyPrice > product.msrp) {
    issues.push({
      type: "msrp_exceeded",
      severity: "warning",
      currentPrice: product.shopifyPrice,
      maxPrice: product.msrp,
      message: `Price $${product.shopifyPrice} exceeds MSRP $${product.msrp}`,
    });
  }

  // Margin analysis
  if (product.cost !== null && product.cost > 0) {
    const margin = (product.shopifyPrice - product.cost) / product.shopifyPrice;

    if (margin <= 0) {
      issues.push({
        type: "very_low_margin",
        severity: "error",
        margin: parseFloat((margin * 100).toFixed(2)),
        message: `Margin is ${(margin * 100).toFixed(1)}% — selling at or below cost`,
      });
    } else if (margin < LOW_MARGIN_THRESHOLD) {
      issues.push({
        type: "low_margin",
        severity: "warning",
        margin: parseFloat((margin * 100).toFixed(2)),
        message: `Margin is ${(margin * 100).toFixed(1)}% — below ${(LOW_MARGIN_THRESHOLD * 100).toFixed(0)}% target`,
      });
    } else if (margin > HIGH_MARGIN_THRESHOLD) {
      issues.push({
        type: "high_margin",
        severity: "info",
        margin: parseFloat((margin * 100).toFixed(2)),
        message: `Margin is ${(margin * 100).toFixed(1)}% — above ${(HIGH_MARGIN_THRESHOLD * 100).toFixed(0)}%`,
      });
    }
  }

  // Zero price
  if (product.shopifyPrice === 0 || product.shopifyPrice === 0.01) {
    issues.push({
      type: "zero_price",
      severity: "error",
      currentPrice: product.shopifyPrice,
      message: `Product has zero or near-zero price ($${product.shopifyPrice})`,
    });
  }

  // Missing pricing
  if (!product.shopifyPrice && !product.mapPrice && !product.msrp) {
    issues.push({
      type: "missing_pricing",
      severity: "warning",
      message: "No pricing data available (shopifyPrice, mapPrice, or msrp)",
    });
  }

  // Compare-at price mismatch
  if (product.compareAtPrice && product.shopifyPrice > product.compareAtPrice) {
    issues.push({
      type: "compare_at_mismatch",
      severity: "warning",
      currentPrice: product.shopifyPrice,
      compareAtPrice: product.compareAtPrice,
      message: `Price $${product.shopifyPrice} is higher than compare-at $${product.compareAtPrice}`,
    });
  }

  return issues;
}

export function calculateRecommendedPrice(product, strategy = "map") {
  switch (strategy) {
    case "map":
      return product.mapPrice || product.msrp || product.cost * (1 + DEFAULT_COST_PLUS_MARGIN);
    case "msrp":
      return product.msrp || product.mapPrice || product.cost * (1 + DEFAULT_COST_PLUS_MARGIN);
    case "cost_plus":
      return product.cost > 0 ? product.cost * (1 + DEFAULT_COST_PLUS_MARGIN) : product.mapPrice || product.msrp;
    case "liquidation":
      return product.cost > 0 ? product.cost * 0.95 : product.mapPrice * 0.9 || product.msrp * 0.9;
    case "clearance":
      return product.cost > 0 ? product.cost : product.mapPrice || product.msrp;
    default:
      return product.mapPrice || product.msrp || product.shopifyPrice;
  }
}

export function calculateUnitPricing(product) {
  const unitPrices = {};

  // Panel: $/W
  if (product.wattage && product.wattage > 0 && product.shopifyPrice > 0) {
    unitPrices.dollarPerWatt = parseFloat((product.shopifyPrice / product.wattage).toFixed(3));
  }

  // Battery: $/kWh
  if (product.ah && product.voltage && product.shopifyPrice > 0) {
    const kWh = (product.ah * product.voltage) / 1000;
    unitPrices.dollarPerKWh = parseFloat((product.shopifyPrice / kWh).toFixed(2));
  }

  // Inverter / Generator: $/kW
  if (product.kwRating && product.kwRating > 0 && product.shopifyPrice > 0) {
    unitPrices.dollarPerKW = parseFloat((product.shopifyPrice / product.kwRating).toFixed(2));
  }

  return unitPrices;
}

export async function runPricingAnalysis(vendorId = null) {
  const where = vendorId ? { vendorId } : {};
  const products = await prisma.vendorProduct.findMany({
    where: { ...where, inShopify: true },
    include: { vendor: true },
  });

  const analysis = {
    total: products.length,
    mapViolations: 0,
    msrpExceeded: 0,
    lowMargin: 0,
    veryLowMargin: 0,
    highMargin: 0,
    zeroPrice: 0,
    missingPricing: 0,
    compareAtMismatch: 0,
    issues: [],
    summary: {
      byVendor: {},
      byCategory: {},
    },
  };

  for (const product of products) {
    const issues = validatePricing(product);

    for (const issue of issues) {
      analysis[issue.type] = (analysis[issue.type] || 0) + 1;
      analysis.issues.push({
        sku: product.sku,
        title: product.title || product.model,
        vendor: product.vendor?.name,
        category: product.category,
        type: issue.type,
        severity: issue.severity,
        currentPrice: product.shopifyPrice,
        mapPrice: product.mapPrice,
        msrp: product.msrp,
        cost: product.cost,
        suggestedPrice: issue.type === "map_violation" ? product.mapPrice : issue.type === "zero_price" ? calculateRecommendedPrice(product) : null,
        message: issue.message,
      });

      // Summary by vendor
      const vendorName = product.vendor?.name || "Unknown";
      analysis.summary.byVendor[vendorName] = (analysis.summary.byVendor[vendorName] || 0) + 1;

      // Summary by category
      analysis.summary.byCategory[product.category || "Uncategorized"] = (analysis.summary.byCategory[product.category || "Uncategorized"] || 0) + 1;
    }
  }

  return analysis;
}

export { DEFAULT_COST_PLUS_MARGIN, LOW_MARGIN_THRESHOLD, HIGH_MARGIN_THRESHOLD };
