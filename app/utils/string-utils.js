/**
 * String Utilities — PES Engine
 * Common string manipulation helpers
 */

/**
 * Clean a SKU string for matching (uppercase, no spaces, no hyphens)
 */
export function cleanSKU(sku) {
  if (!sku) return "";
  return String(sku).toUpperCase().trim().replace(/[-\s]/g, "");
}

/**
 * Clean a title string for matching (uppercase, no extra spaces)
 */
export function cleanTitle(title) {
  if (!title) return "";
  return String(title).toUpperCase().trim().replace(/\s+/g, " ");
}

/**
 * Generate a Shopify handle from text
 */
export function generateHandle(text) {
  if (!text) return "product";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

/**
 * Format currency
 */
export function formatCurrency(amount, currency = "USD") {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Escape HTML special characters
 */
export function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Extract SKU from a string (common patterns)
 */
export function extractSKU(text) {
  if (!text) return null;
  
  // Common SKU patterns: alphanumeric with dashes, underscores, dots
  const patterns = [
    /\b[A-Z]{2,4}-?\d{3,5}[A-Z]?\b/, // e.g., SE-5000, IQ7-60-2-US
    /\b\d{4,5}-\d\b/, // e.g., 5871-0, 6437-0
    /\b[A-Z]{2,3}\d{3,5}\b/, // e.g., RS20, SBX5000
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  
  return null;
}

/**
 * Calculate similarity between two strings (Jaccard index on character bigrams)
 */
export function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const s1 = String(str1).toLowerCase();
  const s2 = String(str2).toLowerCase();
  
  if (s1 === s2) return 1.0;
  
  const bigrams1 = new Set();
  const bigrams2 = new Set();
  
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }
  
  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.substring(i, i + 2));
  }
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);
  
  return intersection.size / union.size;
}

/**
 * Parse model number from product title
 */
export function parseModelFromTitle(title) {
  if (!title) return null;
  
  // Common patterns: Model ABC-123, 18kW, 200A, etc.
  const patterns = [
    /\b(\d{4,5}-\d)\b/, // Generac model: 5871-0
    /\b(\d{1,2}kW)\b/i, // kW rating: 18kW, 22kW
    /\b(\d{1,3}A)\b/, // Amperage: 200A, 100A
    /\b(IQ\d+)\b/i, // Enphase: IQ7, IQ8
    /\b(M\d{3})\b/i, // Enphase: M215, M250
    /\b(SE-\d{4,5}[A-Z]?)\b/i, // SolarEdge: SE-5000H
    /\b(SA-\d{3})\b/i, // Sol-Ark: SA-12K
    /\b(LifePower\d+\s*V\d?)\b/i, // EG4: LifePower4 V2
    /\b(\d{2}kPV)\b/i, // EG4: 18kPV
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Normalize vendor name to code
 */
export function vendorNameToCode(name) {
  if (!name) return "unknown";
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

/**
 * Detect currency from price string
 */
export function detectCurrency(priceString) {
  if (!priceString) return "USD";
  
  const str = String(priceString).trim();
  
  if (str.startsWith("€")) return "EUR";
  if (str.startsWith("£")) return "GBP";
  if (str.startsWith("¥")) return "JPY";
  if (str.startsWith("CAD") || str.includes("CAD")) return "CAD";
  if (str.startsWith("AUD") || str.includes("AUD")) return "AUD";
  
  return "USD";
}
