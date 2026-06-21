/**
 * Competitor Intelligence Module — PES Engine
 * Gap analysis, price comparison, and market positioning
 */

import { prisma } from "../db.server";
import { parseCSV } from "../utils/csv-utils.js";

export async function importCompetitorProducts(csvFilePath, competitorId) {
  const { rows } = parseCSV(csvFilePath);

  const products = rows.map(row => ({
    competitorId,
    sku: row.sku || row.SKU || row["Product SKU"],
    title: row.title || row.Title || row["Product Name"],
    price: parseFloat(row.price || row.Price || row["Retail Price"]) || 0,
    compareAtPrice: parseFloat(row.compareAtPrice || row["Compare At Price"]) || null,
    brand: row.brand || row.Brand || row["Manufacturer"],
    category: row.category || row.Category || row["Product Type"],
    url: row.url || row.URL || row["Product URL"],
    availability: row.availability || row.Availability || "unknown",
    scrapedAt: new Date(),
  }));

  const result = await prisma.competitorProduct.createMany({
    data: products,
    skipDuplicates: true,
  });

  return { imported: result.count, total: products.length };
}

export async function findProductGaps() {
  const competitors = await prisma.competitor.findMany({
    include: { products: true },
  });

  const ourProducts = await prisma.vendorProduct.findMany({
    where: { inShopify: true },
  });

  const ourSkus = new Set(ourProducts.map(p => p.sku));
  const ourTitles = new Set(ourProducts.map(p => p.title?.toLowerCase()));

  const gaps = [];

  for (const competitor of competitors) {
    for (const product of competitor.products) {
      const hasSku = ourSkus.has(product.sku);
      const hasTitle = ourTitles.has(product.title?.toLowerCase());
      const isSimilar = !hasSku && !hasTitle && ourProducts.some(p =>
        p.title?.toLowerCase().includes(product.title?.toLowerCase().split(" ")[0]) ||
        p.sku?.includes(product.sku?.split("-")[0])
      );

      if (!hasSku && !hasTitle && !isSimilar) {
        gaps.push({
          competitorId: competitor.id,
          competitorName: competitor.displayName,
          competitorProduct: product,
          suggestedCategory: product.category,
          matchConfidence: 0,
        });
      } else if (isSimilar) {
        gaps.push({
          competitorId: competitor.id,
          competitorName: competitor.displayName,
          competitorProduct: product,
          suggestedCategory: product.category,
          matchConfidence: 0.5,
          note: "Possible match — manual review recommended",
        });
      }
    }
  }

  return gaps;
}

export async function comparePrices() {
  const ourProducts = await prisma.vendorProduct.findMany({
    where: { inShopify: true },
    include: { vendor: true },
  });

  const competitors = await prisma.competitor.findMany({
    include: { products: true },
  });

  const comparisons = [];

  for (const ourProduct of ourProducts) {
    for (const competitor of competitors) {
      const competitorProduct = competitor.products.find(p =>
        p.sku === ourProduct.sku ||
        p.title?.toLowerCase() === ourProduct.title?.toLowerCase() ||
        p.sku?.includes(ourProduct.sku?.split("-")[0])
      );

      if (competitorProduct) {
        const priceDiff = competitorProduct.price - ourProduct.shopifyPrice;
        const pctDiff = ourProduct.shopifyPrice > 0 ? (priceDiff / ourProduct.shopifyPrice) * 100 : 0;

        let status = "competitive";
        if (priceDiff < -50) status = "lower";
        else if (priceDiff > 50) status = "higher";
        else if (ourProduct.mapPrice && ourProduct.shopifyPrice < ourProduct.mapPrice) status = "map_violation";

        comparisons.push({
          pesProduct: ourProduct,
          competitor,
          competitorProduct,
          pesPrice: ourProduct.shopifyPrice,
          competitorPrice: competitorProduct.price,
          priceDiff: parseFloat(priceDiff.toFixed(2)),
          pctDiff: parseFloat(pctDiff.toFixed(2)),
          status,
          suggestedAction: status === "map_violation" ? "raise_price" : status === "higher" ? "review_margin" : "competitive",
        });
      }
    }
  }

  return comparisons;
}

export async function getCompetitorSummary(competitorId) {
  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
    include: { products: true },
  });

  if (!competitor) return null;

  const products = competitor.products;
  const avgPrice = products.length > 0 ? products.reduce((sum, p) => sum + p.price, 0) / products.length : 0;
  const minPrice = products.length > 0 ? Math.min(...products.map(p => p.price)) : 0;
  const maxPrice = products.length > 0 ? Math.max(...products.map(p => p.price)) : 0;

  return {
    id: competitor.id,
    name: competitor.displayName,
    website: competitor.website,
    totalProducts: products.length,
    avgPrice: parseFloat(avgPrice.toFixed(2)),
    minPrice: parseFloat(minPrice.toFixed(2)),
    maxPrice: parseFloat(maxPrice.toFixed(2)),
    categories: [...new Set(products.map(p => p.category).filter(Boolean))],
    lastUpdated: competitor.lastUpdated,
  };
}

export { importCompetitorProducts, findProductGaps, comparePrices, getCompetitorSummary };
