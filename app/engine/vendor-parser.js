/**
 * Vendor Catalog Parser — PES Engine
 * Auto-detects vendor format (PDF, Excel, CSV) and normalizes to catalog entries
 */

import fs from "fs";
import path from "path";
import { parseCSV, writeCSV } from "../utils/csv-utils.js";
import { parseXLSX, writeXLSX } from "../utils/xlsx-utils.js";
import { parsePDF } from "../utils/pdf-utils.js";
import { prisma } from "../db.server";
import { formatDate, parseDate } from "../utils/date-utils.js";

const VENDOR_PARSERS = {
  generac: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("generac")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "generac" })),
  },
  cummins: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("cummins")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "cummins" })),
  },
  eg4: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("eg4")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "eg4" })),
  },
  enphase: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("enphase")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "enphase" })),
  },
  solaredge: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("solaredge")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "solaredge" })),
  },
  sma: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("sma")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "sma" })),
  },
  fronius: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("fronius")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "fronius" })),
  },
  "sol-ark": {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("sol-ark")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "sol-ark" })),
  },
  victron: {
    detect: (headers) => headers.some((h) => h?.toLowerCase().includes("victron")),
    parse: (rows) => rows.map((row) => ({ ...row, vendor: "victron" })),
  },
  default: {
    detect: () => true,
    parse: (rows) => rows,
  },
};

export function detectVendor(filePath, headers, rows) {
  const fileName = path.basename(filePath).toLowerCase();
  for (const [code, parser] of Object.entries(VENDOR_PARSERS)) {
    if (code !== "default" && fileName.includes(code)) return code;
    if (parser.detect(headers)) return code;
  }
  return "default";
}

export function parseVendorPricebook(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();
  let rows, headers;

  if (ext === ".csv") {
    const parsed = parseCSV(filePath, options);
    rows = parsed.rows;
    headers = parsed.headers;
  } else if (ext === ".xlsx" || ext === ".xls") {
    const parsed = parseXLSX(filePath, options);
    rows = parsed.rows;
    headers = parsed.headers;
  } else if (ext === ".pdf") {
    const parsed = parsePDF(filePath, options);
    rows = parsed.rows;
    headers = parsed.headers;
  } else {
    throw new Error(`Unsupported file format: ${ext}`);
  }

  const vendor = detectVendor(filePath, headers, rows);
  const parser = VENDOR_PARSERS[vendor] || VENDOR_PARSERS.default;
  const normalized = parser.parse(rows);

  return {
    vendor,
    headers,
    rows: normalized,
    totalRows: normalized.length,
    filePath,
    parsedAt: new Date(),
  };
}

export async function findMissingProducts(vendorId) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { products: true },
  });

  if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);

  const shopifyProducts = await prisma.shopifyProduct.findMany({
    where: { vendorId },
  });

  const shopifySkus = new Set(shopifyProducts.map((p) => p.sku));
  const missing = vendor.products.filter((p) => !shopifySkus.has(p.sku));

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    totalVendorProducts: vendor.products.length,
    inShopify: shopifyProducts.length,
    missing: missing.length,
    missingProducts: missing.map((p) => ({
      sku: p.sku,
      title: p.title || p.model,
      vendorSku: p.sku,
      reason: "Not found in Shopify catalog",
    })),
  };
}

export async function compareVendorShopifyPrices(vendorId) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { products: true },
  });

  if (!vendor) throw new Error(`Vendor not found: ${vendorId}`);

  const comparisons = [];

  for (const vp of vendor.products) {
    const sp = await prisma.shopifyProduct.findUnique({
      where: { sku: vp.sku },
    });

    if (!sp) {
      comparisons.push({
        sku: vp.sku,
        status: "missing",
        vendorPrice: vp.price,
        shopifyPrice: null,
        diff: null,
        pctDiff: null,
      });
      continue;
    }

    const diff = sp.price - vp.price;
    const pctDiff = vp.price > 0 ? (diff / vp.price) * 100 : 0;

    comparisons.push({
      sku: vp.sku,
      status: diff === 0 ? "match" : diff > 0 ? "higher" : "lower",
      vendorPrice: vp.price,
      shopifyPrice: sp.price,
      diff,
      pctDiff: parseFloat(pctDiff.toFixed(2)),
      mapPrice: vp.mapPrice,
      msrp: vp.msrp,
    });
  }

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    totalCompared: comparisons.length,
    matches: comparisons.filter((c) => c.status === "match").length,
    higher: comparisons.filter((c) => c.status === "higher").length,
    lower: comparisons.filter((c) => c.status === "lower").length,
    missing: comparisons.filter((c) => c.status === "missing").length,
    mapViolations: comparisons.filter((c) => c.mapPrice && c.shopifyPrice < c.mapPrice).length,
    comparisons,
  };
}

export { VENDOR_PARSERS };
