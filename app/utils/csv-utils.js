import Papa from "papaparse";
import fs from "fs";

/**
 * CSV Utilities — PES Engine
 * Handles CSV parsing, generation, and manipulation
 */

/**
 * Parse CSV from string or file path
 */
export function parseCSVString(csvString, options = {}) {
  return new Promise((resolve, reject) => {
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      ...options,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
}

/**
 * Parse CSV from file path
 */
export function parseCSVFile(filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const file = fs.createReadStream(filePath, { encoding: "utf-8" });
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      ...options,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    });
  });
}

/**
 * Generate CSV from array of objects
 */
export function generateCSV(data, columns = null) {
  if (!data || data.length === 0) return "";
  
  const headers = columns || Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return "";
      // Escape quotes and wrap in quotes if contains comma or quote
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Write CSV to file
 */
export function writeCSVToFile(filePath, data, columns = null) {
  const csv = generateCSV(data, columns);
  fs.writeFileSync(filePath, csv, "utf-8");
  return filePath;
}

/**
 * Read CSV and return as array of objects with normalized keys
 */
export function readCSVNormalized(filePath, options = {}) {
  return parseCSVFile(filePath, options).then(data => {
    return data.map(row => {
      const normalized = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
        normalized[normalizedKey] = value;
      }
      return normalized;
    });
  });
}

/**
 * Filter CSV data by criteria
 */
export function filterCSVData(data, criteria) {
  return data.filter(row => {
    for (const [key, value] of Object.entries(criteria)) {
      if (row[key] !== value) return false;
    }
    return true;
  });
}

/**
 * Map CSV data to new structure
 */
export function mapCSVData(data, mapper) {
  return data.map(row => {
    const mapped = {};
    for (const [newKey, oldKeyOrFn] of Object.entries(mapper)) {
      if (typeof oldKeyOrFn === "function") {
        mapped[newKey] = oldKeyOrFn(row);
      } else {
        mapped[newKey] = row[oldKeyOrFn];
      }
    }
    return mapped;
  });
}

/**
 * Convert array of objects to Matrixify CSV format for Shopify
 */
export function toShopifyMatrixifyCSV(products) {
  const matrixifyHeaders = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams",
    "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy",
    "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price",
    "Variant Requires Shipping", "Variant Taxable", "Variant Barcode",
    "Image Src", "Image Position", "Image Alt Text", "SEO Title", "SEO Description",
    "Google Shopping / Google Product Category", "Google Shopping / Gender",
    "Google Shopping / Age Group", "Google Shopping / MPN",
    "Google Shopping / AdWords Grouping", "Google Shopping / AdWords Labels",
    "Google Shopping / Condition", "Google Shopping / Custom Product",
    "Google Shopping / Custom Label 0", "Google Shopping / Custom Label 1",
    "Google Shopping / Custom Label 2", "Google Shopping / Custom Label 3",
    "Google Shopping / Custom Label 4", "Variant Image", "Variant Weight Unit",
    "Variant Tax Code", "Cost per item", "Status",
    "Metafield: lifecycle.status [single_line_text_field]",
    "Metafield: lifecycle.eol_strategy [single_line_text_field]",
    "Metafield: lifecycle.replacement_handle [single_line_text_field]",
    "Metafield: lifecycle.replacement_benefit [multi_line_text_field]",
    "Metafield: cross_sell.html_banner [multi_line_text_field]",
    "Metafield: specs.datasheet_url [url]",
    "Metafield: specs.manual_url [url]",
    "Metafield: pricing.map_price [number_decimal]",
    "Metafield: pricing.msrp [number_decimal]",
    "Metafield: pricing.gold_cost [number_decimal]",
    "Metafield: vendor.part_number [single_line_text_field]",
    "Metafield: vendor.gold_cost [number_decimal]",
    "Metafield: vendor.warranty [single_line_text_field]",
  ];
  
  const rows = products.map(p => {
    const handle = generateHandle(p.title || p.model || p.sku);
    return [
      handle,
      p.title || p.model || p.sku,
      p.description || "",
      p.vendor?.name || p.vendor || "",
      p.category || "",
      `${p.vendor?.name || p.vendor || ""},${p.category || ""}`,
      "TRUE",
      "Title", "Default Title",
      p.sku,
      "0",
      "shopify", "0", "deny", "manual",
      p.mapPrice || p.msrp || p.goldCost || "0",
      p.msrp || "",
      "TRUE", "TRUE",
      p.ean || p.upc || "",
      "", "", "",
      p.title || p.model || p.sku,
      p.description || "",
      "", "", "", p.sku,
      "", "", "new", "FALSE",
      "", "", "", "", "", "", "", "lb", "",
      p.goldCost || "",
      p.lifecycle || "active",
      p.lifecycle || "active",
      p.eolStrategy || "",
      p.replacement?.shopifyProductHandle || "",
      p.replacementBenefit || "",
      p.htmlBanner || "",
      "", "", // spec URLs
      p.mapPrice || "",
      p.msrp || "",
      p.goldCost || "",
      p.sku || "",
      p.goldCost || "",
      p.warranty || "",
    ];
  });
  
  return [matrixifyHeaders, ...rows];
}

function generateHandle(text) {
  if (!text) return "product";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}
