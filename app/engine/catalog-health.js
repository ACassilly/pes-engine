/**
 * Catalog Health Monitor — PES Engine
 * Detects and fixes catalog issues: zero-price, broken handles, missing metadata, etc.
 */

import { prisma } from "../db.server";

const HEALTH_CHECKS = {
  zero_price: {
    name: "Zero or Near-Zero Price",
    severity: "critical",
    check: (product) => product.shopifyPrice === 0 || product.shopifyPrice === 0.01,
    suggestedAction: "update_price",
    description: (product) => `Product ${product.sku} has price $${product.shopifyPrice}`,
  },
  broken_handle: {
    name: "Broken Handle",
    severity: "high",
    check: (product) => !product.handle || product.handle.includes(" ") || product.handle.includes("_"),
    suggestedAction: "regenerate_handle",
    description: (product) => `Product ${product.sku} has invalid handle: ${product.handle}`,
  },
  uncategorized: {
    name: "Uncategorized Product",
    severity: "medium",
    check: (product) => !product.category || product.category === "false" || product.category === "UNKNOWN",
    suggestedAction: "infer_category",
    description: (product) => `Product ${product.sku} has no valid category`,
  },
  missing_brand: {
    name: "Missing Brand",
    severity: "medium",
    check: (product) => !product.brand || product.brand === "UNKNOWN" || product.brand === "",
    suggestedAction: "infer_brand",
    description: (product) => `Product ${product.sku} has no brand`,
  },
  missing_images: {
    name: "Missing Images",
    severity: "medium",
    check: (product) => !product.imageCount || product.imageCount === 0,
    suggestedAction: "add_placeholder",
    description: (product) => `Product ${product.sku} has no images`,
  },
  duplicate_sku: {
    name: "Duplicate SKU",
    severity: "high",
    check: (product, allProducts) => {
      const duplicates = allProducts.filter(p => p.sku === product.sku);
      return duplicates.length > 1;
    },
    suggestedAction: "merge_or_split",
    description: (product) => `Product ${product.sku} appears ${allProducts.filter(p => p.sku === product.sku).length} times`,
  },
  missing_metadata: {
    name: "Missing Metadata",
    severity: "low",
    check: (product) => !product.title || !product.description || product.description.length < 50,
    suggestedAction: "infer_from_vendor",
    description: (product) => `Product ${product.sku} has incomplete metadata`,
  },
  missing_compare_at: {
    name: "Missing Compare-At Price",
    severity: "low",
    check: (product) => !product.compareAtPrice && product.msrp,
    suggestedAction: "set_compare_at_msrp",
    description: (product) => `Product ${product.sku} has MSRP but no compare-at price`,
  },
  pdp_404: {
    name: "PDP 404",
    severity: "critical",
    check: (product) => product.status === "404" || product.status === "not_found",
    suggestedAction: "investigate",
    description: (product) => `Product ${product.sku} returns 404 on PDP`,
  },
  wrong_category: {
    name: "Wrong Category",
    severity: "medium",
    check: (product) => {
      const expected = inferCategoryFromTitle(product.title);
      return expected && product.category !== expected;
    },
    suggestedAction: "recategorize",
    description: (product) => `Product ${product.sku} may be in wrong category`,
  },
  missing_tags: {
    name: "Missing Tags",
    severity: "low",
    check: (product) => !product.tags || product.tags.length === 0,
    suggestedAction: "generate_tags",
    description: (product) => `Product ${product.sku} has no tags`,
  },
  orphaned_product: {
    name: "Orphaned Product",
    severity: "medium",
    check: (product) => product.vendorId && !product.vendor,
    suggestedAction: "link_vendor",
    description: (product) => `Product ${product.sku} has vendorId but no linked vendor`,
  },
};

function inferCategoryFromTitle(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (t.includes("panel") || t.includes("module") || t.includes("solar cell")) return "Solar Panels";
  if (t.includes("inverter") || t.includes("converter")) return "Inverters";
  if (t.includes("battery") || t.includes("储能") || t.includes("energy storage")) return "Batteries";
  if (t.includes("generator") || t.includes("genset") || t.includes("cummins") || t.includes("generac")) return "Generators";
  if (t.includes("charge controller") || t.includes("mppt") || t.includes("pwm")) return "Charge Controllers";
  if (t.includes("mount") || t.includes("rack") || t.includes("rail")) return "Mounting";
  if (t.includes("monitor") || t.includes("gateway") || t.includes("communication")) return "Monitoring";
  if (t.includes("cable") || t.includes("wire") || t.includes("connector")) return "Cables";
  if (t.includes("breaker") || t.includes("fuse") || t.includes("switch")) return "Electrical";
  return null;
}

export async function runFullHealthScan() {
  const products = await prisma.shopifyProduct.findMany({
    include: { vendorProduct: true },
  });

  const issues = [];

  for (const product of products) {
    for (const [checkId, checkConfig] of Object.entries(HEALTH_CHECKS)) {
      const allProducts = products; // Pass all for duplicate check
      if (checkConfig.check(product, allProducts)) {
        issues.push({
          id: `${product.id}_${checkId}`,
          shopifyProductId: product.id,
          issueType: checkId,
          severity: checkConfig.severity,
          description: checkConfig.description(product),
          suggestedAction: checkConfig.suggestedAction,
          status: "open",
          createdAt: new Date(),
        });
      }
    }
  }

  // Store issues
  await prisma.healthIssue.createMany({
    data: issues,
    skipDuplicates: true,
  });

  // Calculate health score
  const totalProducts = products.length;
  const totalIssues = issues.length;
  const criticalIssues = issues.filter(i => i.severity === "critical").length;
  const highIssues = issues.filter(i => i.severity === "high").length;
  const mediumIssues = issues.filter(i => i.severity === "medium").length;
  const lowIssues = issues.filter(i => i.severity === "low").length;

  const weights = { critical: 10, high: 5, medium: 2, low: 0.5 };
  const weightedScore = (criticalIssues * weights.critical + highIssues * weights.high + mediumIssues * weights.medium + lowIssues * weights.low) / Math.max(totalProducts, 1);
  const healthScore = Math.max(0, Math.min(100, 100 - (weightedScore * 10)));

  // Store snapshot
  await prisma.analyticsSnapshot.create({
    data: {
      snapshotType: "catalog_health",
      data: JSON.stringify({
        totalProducts,
        totalIssues,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        healthScore: parseFloat(healthScore.toFixed(2)),
      }),
      healthScore: parseFloat(healthScore.toFixed(2)),
    },
  });

  return {
    totalProducts,
    totalIssues,
    healthScore: parseFloat(healthScore.toFixed(2)),
    bySeverity: { critical: criticalIssues, high: highIssues, medium: mediumIssues, low: lowIssues },
    byType: issues.reduce((acc, i) => { acc[i.issueType] = (acc[i.issueType] || 0) + 1; return acc; }, {}),
    issues: issues.slice(0, 100),
  };
}

export async function applyHealthFix(issueId, action, userId = null) {
  const issue = await prisma.healthIssue.findUnique({
    where: { id: issueId },
  });

  if (!issue) throw new Error(`Issue not found: ${issueId}`);

  const product = await prisma.shopifyProduct.findUnique({
    where: { id: issue.shopifyProductId },
  });

  if (!product) throw new Error(`Product not found: ${issue.shopifyProductId}`);

  let result = null;

  switch (action) {
    case "update_price":
      // Update to recommended price
      const recommended = product.mapPrice || product.msrp || product.cost * 1.15 || 0.99;
      await prisma.shopifyProduct.update({
        where: { id: product.id },
        data: { shopifyPrice: recommended },
      });
      result = { action: "update_price", newPrice: recommended };
      break;

    case "regenerate_handle":
      const newHandle = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await prisma.shopifyProduct.update({
        where: { id: product.id },
        data: { handle: newHandle },
      });
      result = { action: "regenerate_handle", newHandle };
      break;

    case "infer_category":
      const category = inferCategoryFromTitle(product.title);
      if (category) {
        await prisma.shopifyProduct.update({
          where: { id: product.id },
          data: { category },
        });
      }
      result = { action: "infer_category", category };
      break;

    case "infer_brand":
      const brand = product.vendor?.name || product.title?.split(" ")[0] || "UNKNOWN";
      await prisma.shopifyProduct.update({
        where: { id: product.id },
        data: { brand },
      });
      result = { action: "infer_brand", brand };
      break;

    case "set_compare_at_msrp":
      await prisma.shopifyProduct.update({
        where: { id: product.id },
        data: { compareAtPrice: product.msrp },
      });
      result = { action: "set_compare_at_msrp", compareAtPrice: product.msrp };
      break;

    case "generate_tags":
      const tags = [product.category, product.brand, product.vendor?.code].filter(Boolean);
      await prisma.shopifyProduct.update({
        where: { id: product.id },
        data: { tags: JSON.stringify(tags) },
      });
      result = { action: "generate_tags", tags };
      break;

    default:
      result = { action: "manual_review", message: "Requires manual review" };
  }

  // Update issue status
  await prisma.healthIssue.update({
    where: { id: issueId },
    data: { status: "fixed", fixedAt: new Date(), fixedBy: userId },
  });

  // Log audit
  await prisma.auditLog.create({
    data: {
      action: "health_fix",
      targetType: "shopifyProduct",
      targetId: product.id,
      details: JSON.stringify({ issueId, action, result }),
      status: "success",
      userId,
    },
  });

  return result;
}

export { HEALTH_CHECKS, inferCategoryFromTitle };
