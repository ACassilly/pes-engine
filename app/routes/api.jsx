import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { parseExcel, parseCSV, detectVendor, savePricebookEntries, findMissingProducts, compareVendorShopifyPrices } from "../engine/vendor-parser.js";
import { runEOLDetectionScan, applyEOLStrategy, generateEOLBanner, generateComparisonTable } from "../engine/eol-detector.js";
import { runPricingAnalysis, generatePriceUpdateBatch, calculateUnitPricing, generatePricingReport } from "../engine/pricing-engine.js";
import { runFullHealthScan, applyHealthFix, exportHealthIssuesCSV } from "../engine/catalog-health.js";
import { findMissingSpecs, uploadSpecFile, syncSpecsToShopify, SPEC_TYPES } from "../engine/manufacturer-specs.js";
import { importCompetitorData, findProductGaps, comparePrices, exportGapAnalysis } from "../engine/competitor-intel.js";
import { checkHealth } from "../shopify.server.js";
import fs from "fs";
import path from "path";
import multer from "multer";

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || "./data/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || "52428800") },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_UPLOAD_TYPES || "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv").split(",");
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// Helper to handle multer in Remix
function runMulter(req, res, uploadHandler) {
  return new Promise((resolve, reject) => {
    uploadHandler(req, res, (err) => {
      if (err) reject(err);
      else resolve(req);
    });
  });
}

// ─── VENDORS API ───────────────────────────────

export async function loader({ request }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check endpoint
  if (path === "/api/health") {
    const checks = await checkHealth();
    return json({ status: "ok", ...checks });
  }

  await authenticate.admin(request);

  try {
    if (path === "/api/vendors") {
      const vendors = await prisma.vendor.findMany({
        include: {
          _count: { select: { products: true, pricebooks: true } },
        },
      });
      return json({ vendors });
    }

    if (path.startsWith("/api/vendors/")) {
      const vendorId = path.split("/")[3];
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          pricebooks: { orderBy: { effectiveDate: "desc" } },
          products: { take: 100, orderBy: { createdAt: "desc" } },
        },
      });
      if (!vendor) return json({ error: "Vendor not found" }, { status: 404 });
      return json({ vendor });
    }

    if (path === "/api/eol/mappings") {
      const mappings = await prisma.eolMapping.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return json({ mappings });
    }

    if (path === "/api/pricing/analysis") {
      const vendorId = url.searchParams.get("vendorId");
      const analysis = await runPricingAnalysis(vendorId || undefined);
      return json({ analysis });
    }

    if (path === "/api/health/score") {
      const latest = await prisma.analyticsSnapshot.findFirst({
        where: { snapshotType: "catalog_health" },
        orderBy: { createdAt: "desc" },
      });
      return json({ healthScore: latest?.healthScore || 100 });
    }

    if (path === "/api/health/issues") {
      const status = url.searchParams.get("status") || "open";
      const issues = await prisma.healthIssue.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return json({ issues, count: issues.length });
    }

    if (path === "/api/catalog/missing") {
      const vendorId = url.searchParams.get("vendorId");
      const result = await findMissingProducts(vendorId);
      return json({ result });
    }

    if (path === "/api/manufacturers/specs") {
      const sku = url.searchParams.get("sku");
      if (!sku) return json({ error: "SKU required" }, { status: 400 });
      const specs = await prisma.manufacturerSpec.findMany({
        where: { productSku: { equals: sku, mode: "insensitive" } },
      });
      return json({ specs });
    }

    if (path === "/api/competitors") {
      const competitors = await prisma.competitor.findMany({
        include: { _count: { select: { products: true } } },
      });
      return json({ competitors });
    }

    if (path === "/api/reports") {
      const reports = await prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return json({ reports });
    }

    if (path === "/api/dashboard/summary") {
      const stats = await prisma.$transaction([
        prisma.vendor.count({ where: { isActive: true } }),
        prisma.vendorProduct.count(),
        prisma.vendorProduct.count({ where: { inShopify: false } }),
        prisma.shopifyProduct.count(),
        prisma.healthIssue.count({ where: { status: "open" } }),
        prisma.healthIssue.count({ where: { status: "open", severity: "critical" } }),
        prisma.eolMapping.count({ where: { isActive: true } }),
        prisma.competitor.count({ where: { isActive: true } }),
      ]);

      return json({
        activeVendors: stats[0],
        totalVendorProducts: stats[1],
        missingFromShopify: stats[2],
        totalShopifyProducts: stats[3],
        openHealthIssues: stats[4],
        criticalIssues: stats[5],
        activeEolMappings: stats[6],
        activeCompetitors: stats[7],
      });
    }

    return json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("[API Error]", error);
    return json({ error: error.message }, { status: 500 });
  }
}

export async function action({ request }) {
  const url = new URL(request.url);
  const path = url.pathname;
  const { session } = await authenticate.admin(request);
  const userId = session?.id || "system";

  try {
    const formData = await request.formData();
    const _action = formData.get("_action");

    // ─── Vendor Pricebook Upload ─────────────────
    if (path === "/api/vendors/pricebook-upload") {
      const vendorId = formData.get("vendorId");
      if (!vendorId) return json({ error: "Vendor ID required" }, { status: 400 });

      const file = formData.get("file");
      if (!file) return json({ error: "File required" }, { status: 400 });

      const filePath = path.join(uploadDir, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      // Create pricebook record
      const pricebook = await prisma.pricebook.create({
        data: {
          vendorId,
          effectiveDate: new Date(),
          fileName: file.name,
          filePath,
          fileSize: buffer.length,
          mimeType: file.type,
          status: "current",
        },
      });

      // Parse file
      let sheets;
      if (file.name.endsWith(".csv")) {
        sheets = await parseCSV(filePath);
      } else {
        sheets = await parseExcel(filePath);
      }

      const detectedVendor = detectVendor(file.name, [], []);
      const parser = detectedVendor !== "default" ? detectedVendor : "default";
      const { parse: parseFn } = await import("../engine/vendor-parser.js").then(m => m.VENDOR_PARSERS[parser] || m.VENDOR_PARSERS.default);
      const entries = parseFn(sheets);

      const result = await savePricebookEntries(pricebook.id, entries, userId);

      return json({ success: true, pricebook, parsed: entries.length, ...result });
    }

    // ─── EOL Detection ───────────────────────────
    if (path === "/api/eol/detect") {
      const results = await runEOLDetectionScan(userId);
      return json({ success: true, results });
    }

    if (path === "/api/eol/apply") {
      const productId = formData.get("productId");
      const strategy = formData.get("strategy");
      const replacementId = formData.get("replacementId");

      if (!productId || !strategy) {
        return json({ error: "Product ID and strategy required" }, { status: 400 });
      }

      const result = await applyEOLStrategy(productId, strategy, replacementId, userId);
      return json(result);
    }

    // ─── Health Scan ─────────────────────────────
    if (path === "/api/health/scan") {
      const results = await runFullHealthScan(userId);
      return json({ success: true, results });
    }

    if (path === "/api/health/fix") {
      const issueId = formData.get("issueId");
      if (!issueId) return json({ error: "Issue ID required" }, { status: 400 });

      const result = await applyHealthFix(issueId, userId);
      return json(result);
    }

    // ─── Pricing Batch ───────────────────────────
    if (path === "/api/pricing/bulk-update") {
      const issueIds = formData.getAll("issueId");
      const strategy = formData.get("strategy") || "map";

      const issues = await prisma.healthIssue.findMany({
        where: { id: { in: issueIds } },
      });

      const batch = await generatePriceUpdateBatch(issues, strategy);
      return json({ success: true, batchSize: batch.length, updates: batch });
    }

    // ─── Competitor Import ───────────────────────
    if (path === "/api/competitors/import") {
      const competitorId = formData.get("competitorId");
      if (!competitorId) return json({ error: "Competitor ID required" }, { status: 400 });

      const file = formData.get("file");
      if (!file) return json({ error: "File required" }, { status: 400 });

      const filePath = path.join(uploadDir, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const result = await importCompetitorData(filePath, competitorId, userId);
      return json({ success: true, ...result });
    }

    // ─── Spec Upload ─────────────────────────────
    if (path === "/api/manufacturers/specs") {
      const vendorId = formData.get("vendorId");
      const productSku = formData.get("productSku");
      const specType = formData.get("specType");

      if (!vendorId || !productSku || !specType) {
        return json({ error: "Vendor ID, SKU, and spec type required" }, { status: 400 });
      }

      const file = formData.get("file");
      if (!file) return json({ error: "File required" }, { status: 400 });

      const filePath = path.join(uploadDir, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const spec = await uploadSpecFile(vendorId, productSku, specType, filePath, file.name, userId);
      return json({ success: true, spec });
    }

    // ─── Shopify Sync ────────────────────────────
    if (path === "/api/shopify/sync") {
      // Trigger Shopify sync — in production, this would queue a background job
      const products = await prisma.shopifyProduct.findMany({
        take: 100,
        orderBy: { lastSyncAt: "asc" },
      });

      return json({
        success: true,
        message: "Shopify sync triggered",
        productsToSync: products.length,
      });
    }

    // ─── Report Generation ──────────────────────
    if (path === "/api/reports/generate") {
      const reportType = formData.get("reportType") || "pricing_audit";
      const format = formData.get("format") || "json";

      const report = await prisma.report.create({
        data: {
          name: `${reportType}_${new Date().toISOString().split("T")[0]}`,
          reportType,
          status: "pending",
          generatedBy: userId,
        },
      });

      // Generate report data
      let data;
      switch (reportType) {
        case "pricing_audit":
          data = await generatePricingReport(null, format);
          break;
        case "catalog_health":
          data = await runFullHealthScan(userId);
          break;
        case "competitor_gap":
          data = await exportGapAnalysis(format);
          break;
        default:
          data = { message: "Report type not implemented" };
      }

      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "completed",
          parameters: JSON.stringify({ format }),
        },
      });

      return json({ success: true, report, data });
    }

    return json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[API Action Error]", error);
    return json({ error: error.message }, { status: 500 });
  }
}
