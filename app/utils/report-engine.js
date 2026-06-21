import { prisma } from "../db.server";
import { formatDate } from "./date-utils";

/**
 * Report Engine — PES Engine
 * Generates structured reports for pricing, health, EOL, and competitor analysis
 */

export async function generatePricingAuditReport(vendorId = null, format = "json") {
  const { runPricingAnalysis } = await import("../engine/pricing-engine.js");
  const analysis = await runPricingAnalysis(vendorId);
  const report = {
    generatedAt: new Date().toISOString(),
    type: "pricing_audit",
    vendorId,
    summary: {
      totalProducts: analysis.total,
      mapViolations: analysis.mapViolations,
      msrpExceeded: analysis.msrpExceeded,
      lowMargin: analysis.lowMargin + analysis.veryLowMargin,
      highMargin: analysis.highMargin,
      zeroPrice: analysis.zeroPrice,
      missingPricing: analysis.missingPricing,
      compareAtMismatch: analysis.compareAtMismatch,
      totalIssues: analysis.issues.length,
    },
    byVendor: analysis.summary?.byVendor || {},
    byCategory: analysis.summary?.byCategory || {},
    issues: analysis.issues.map(issue => ({
      sku: issue.sku,
      title: issue.title,
      vendor: issue.vendor,
      category: issue.category,
      issueType: issue.type,
      severity: issue.severity,
      currentPrice: issue.currentPrice,
      suggestedPrice: issue.suggestedPrice,
      message: issue.message,
    })),
    recommendations: analysis.issues
      .filter(i => i.suggestedPrice)
      .map(issue => ({
        sku: issue.sku,
        title: issue.title,
        currentPrice: issue.currentPrice,
        recommendedPrice: issue.suggestedPrice,
        reason: issue.type,
        action: "update_price",
      })),
  };
  if (format === "csv") {
    return convertToCSV(report.issues, [
      "sku", "title", "vendor", "category", "issueType", "severity",
      "currentPrice", "suggestedPrice", "message",
    ]);
  }
  return report;
}

export async function generateEOLAuditReport(format = "json") {
  const eolProducts = await prisma.vendorProduct.findMany({
    where: {
      lifecycle: { in: ["legacy", "clearance", "liquidation", "discontinued_reference"] },
    },
    include: { vendor: true, replacement: true },
  });
  const report = {
    generatedAt: new Date().toISOString(),
    type: "eol_audit",
    summary: {
      totalEOL: eolProducts.length,
      byStrategy: {
        legacy: eolProducts.filter(p => p.lifecycle === "legacy").length,
        clearance: eolProducts.filter(p => p.lifecycle === "clearance").length,
        liquidation: eolProducts.filter(p => p.lifecycle === "liquidation").length,
        discontinued_reference: eolProducts.filter(p => p.lifecycle === "discontinued_reference").length,
      },
      byVendor: {},
      withReplacement: eolProducts.filter(p => p.replacementId).length,
      withoutReplacement: eolProducts.filter(p => !p.replacementId).length,
      inShopify: eolProducts.filter(p => p.inShopify).length,
    },
    products: eolProducts.map(p => ({
      sku: p.sku,
      title: p.title || p.model,
      vendor: p.vendor?.name,
      lifecycle: p.lifecycle,
      eolStrategy: p.eolStrategy,
      replacementSku: p.replacement?.sku || null,
      replacementModel: p.replacement?.model || null,
      replacementConfidence: p.replacementConfidence,
      inShopify: p.inShopify,
      shopifyPrice: p.shopifyPrice,
      mapPrice: p.mapPrice,
      msrp: p.msrp,
      eolDetectedAt: p.eolDetectedAt,
    })),
  };
  for (const p of eolProducts) {
    const vendorName = p.vendor?.name || "Unknown";
    report.summary.byVendor[vendorName] = (report.summary.byVendor[vendorName] || 0) + 1;
  }
  if (format === "csv") {
    return convertToCSV(report.products, [
      "sku", "title", "vendor", "lifecycle", "eolStrategy",
      "replacementSku", "replacementModel", "replacementConfidence",
      "inShopify", "shopifyPrice", "mapPrice", "msrp",
    ]);
  }
  return report;
}

export async function generateHealthReport(format = "json") {
  const issues = await prisma.healthIssue.findMany({
    where: { status: "open" },
    orderBy: { severity: "desc" },
  });
  const stats = {
    total: await prisma.healthIssue.count(),
    open: await prisma.healthIssue.count({ where: { status: "open" } }),
    critical: await prisma.healthIssue.count({ where: { status: "open", severity: "critical" } }),
    high: await prisma.healthIssue.count({ where: { status: "open", severity: "high" } }),
    medium: await prisma.healthIssue.count({ where: { status: "open", severity: "medium" } }),
    low: await prisma.healthIssue.count({ where: { status: "open", severity: "low" } }),
    fixed: await prisma.healthIssue.count({ where: { status: "fixed" } }),
    ignored: await prisma.healthIssue.count({ where: { status: "ignored" } }),
  };
  const latestSnapshot = await prisma.analyticsSnapshot.findFirst({
    where: { snapshotType: "catalog_health" },
    orderBy: { createdAt: "desc" },
  });
  const report = {
    generatedAt: new Date().toISOString(),
    type: "catalog_health",
    healthScore: latestSnapshot?.healthScore || 100,
    summary: stats,
    byIssueType: {},
    issues: issues.map(i => ({
      id: i.id.substring(0, 8),
      issueType: i.issueType,
      severity: i.severity,
      description: i.description,
      suggestedAction: i.suggestedAction,
      status: i.status,
      createdAt: i.createdAt,
    })),
  };
  for (const issue of issues) {
    report.byIssueType[issue.issueType] = (report.byIssueType[issue.issueType] || 0) + 1;
  }
  if (format === "csv") {
    return convertToCSV(report.issues, [
      "id", "issueType", "severity", "description", "suggestedAction", "status", "createdAt",
    ]);
  }
  return report;
}

export async function generateCompetitorGapReport(format = "json") {
  const { findProductGaps, comparePrices } = await import("../engine/competitor-intel.js");
  const gaps = await findProductGaps();
  const comparisons = await comparePrices();
  const report = {
    generatedAt: new Date().toISOString(),
    type: "competitor_gap",
    summary: {
      totalGaps: gaps.length,
      totalComparisons: comparisons.length,
      competitiveProducts: comparisons.filter(c => c.status === "competitive").length,
      higherPriced: comparisons.filter(c => c.status === "higher").length,
      lowerPriced: comparisons.filter(c => c.status === "lower").length,
      mapViolations: comparisons.filter(c => c.status === "map_violation").length,
    },
    byCompetitor: {},
    gaps: gaps.slice(0, 100).map(g => ({
      competitor: g.competitorName,
      sku: g.competitorProduct.sku || "—",
      title: g.competitorProduct.title,
      brand: g.competitorProduct.brand,
      category: g.suggestedCategory,
      matchConfidence: g.matchConfidence,
    })),
    priceComparisons: comparisons.slice(0, 100).map(c => ({
      sku: c.pesProduct.sku,
      title: c.pesProduct.title?.substring(0, 40),
      competitor: c.competitor?.displayName,
      pesPrice: c.pesPrice,
      competitorPrice: c.competitorPrice,
      priceDiff: c.priceDiff,
      pctDiff: c.pctDiff,
      status: c.status,
    })),
  };
  for (const gap of gaps) {
    const name = gap.competitorName;
    report.byCompetitor[name] = (report.byCompetitor[name] || 0) + 1;
  }
  if (format === "csv") {
    return convertToCSV(report.gaps, [
      "competitor", "sku", "title", "brand", "category", "matchConfidence",
    ]);
  }
  return report;
}

export async function generateVendorSyncReport(format = "json") {
  const vendors = await prisma.vendor.findMany({
    include: {
      _count: { select: { products: true, pricebooks: true } },
      pricebooks: { orderBy: { effectiveDate: "desc" }, take: 1 },
    },
  });
  const report = {
    generatedAt: new Date().toISOString(),
    type: "vendor_sync",
    summary: {
      totalVendors: vendors.length,
      totalProducts: vendors.reduce((sum, v) => sum + v._count.products, 0),
      totalPricebooks: vendors.reduce((sum, v) => sum + v._count.pricebooks, 0),
      missingProducts: await prisma.vendorProduct.count({ where: { inShopify: false } }),
    },
    vendors: vendors.map(v => ({
      name: v.name,
      code: v.code,
      contact: v.contactName || "—",
      products: v._count.products,
      pricebooks: v._count.pricebooks,
      latestPricebook: v.pricebooks[0]?.effectiveDate
        ? formatDate(v.pricebooks[0].effectiveDate)
        : "—",
      status: v.isActive ? "Active" : "Inactive",
    })),
  };
  if (format === "csv") {
    return convertToCSV(report.vendors, [
      "name", "code", "contact", "products", "pricebooks", "latestPricebook", "status",
    ]);
  }
  return report;
}

function convertToCSV(data, headers) {
  if (!data || data.length === 0) return "";
  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function generateReport(reportType, options = {}) {
  const { vendorId, format = "json" } = options;
  switch (reportType) {
    case "pricing_audit":
      return generatePricingAuditReport(vendorId, format);
    case "eol_audit":
      return generateEOLAuditReport(format);
    case "catalog_health":
      return generateHealthReport(format);
    case "competitor_gap":
      return generateCompetitorGapReport(format);
    case "vendor_sync":
      return generateVendorSyncReport(format);
    case "margin_analysis":
      return generatePricingAuditReport(vendorId, format);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

export { convertToCSV };
