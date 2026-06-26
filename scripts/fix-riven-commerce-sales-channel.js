/**
 * Riven Commerce (Medusa v2) Sales Channel Fix
 * Assigns all products to the default sales channel.
 * 
 * Usage: node scripts/fix-riven-commerce-sales-channel.js
 * Required: RIVEN_COMMERCE_API_KEY env var
 */

const MEDUSA_URL = process.env.RIVEN_COMMERCE_URL || "https://api.riven.ai";
const API_KEY = process.env.RIVEN_COMMERCE_API_KEY;

async function medusaFetch(endpoint, options = {}) {
  const url = `${MEDUSA_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Medusa API error ${response.status}: ${error}`);
  }
  return response.json();
}

async function getSalesChannels() {
  const data = await medusaFetch("/admin/sales-channels?limit=100");
  return data.sales_channels || [];
}

async function getProducts(limit = 100, offset = 0) {
  const data = await medusaFetch(`/admin/products?limit=${limit}&offset=${offset}`);
  return { products: data.products || [], count: data.count || 0 };
}

async function assignProductsToSalesChannel(productIds, salesChannelId) {
  return medusaFetch(`/admin/sales-channels/${salesChannelId}/products`, {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds }),
  });
}

async function fixSalesChannels() {
  if (!API_KEY) {
    console.error("ERROR: RIVEN_COMMERCE_API_KEY is not set");
    process.exit(1);
  }
  const channels = await getSalesChannels();
  if (channels.length === 0) {
    console.error("ERROR: No sales channels found!");
    process.exit(1);
  }
  const defaultChannel = channels.find(c =>
    c.name.toLowerCase().includes("default") ||
    c.name.toLowerCase().includes("web")
  ) || channels[0];
  console.log(`Using sales channel: ${defaultChannel.name} (${defaultChannel.id})`);

  const allProducts = [];
  let offset = 0;
  const limit = 100;
  let totalCount = 0;
  do {
    const batch = await getProducts(limit, offset);
    allProducts.push(...batch.products);
    totalCount = batch.count;
    offset += limit;
    console.log(`  Fetched ${allProducts.length}/${totalCount} products...`);
  } while (allProducts.length < totalCount);

  const productsToFix = allProducts.filter(p => {
    const channelIds = p.sales_channels?.map(sc => sc.id) || [];
    return !channelIds.includes(defaultChannel.id);
  });
  console.log(`Products missing from '${defaultChannel.name}': ${productsToFix.length}`);

  if (productsToFix.length === 0) {
    console.log("All products already assigned!");
    return;
  }

  const batchSize = 50;
  let fixed = 0;
  for (let i = 0; i < productsToFix.length; i += batchSize) {
    const batch = productsToFix.slice(i, i + batchSize);
    try {
      await assignProductsToSalesChannel(batch.map(p => p.id), defaultChannel.id);
      fixed += batch.length;
      console.log(`  Fixed ${fixed}/${productsToFix.length}...`);
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`Done! Fixed ${fixed}/${productsToFix.length} products.`);
}

fixSalesChannels().catch(e => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
