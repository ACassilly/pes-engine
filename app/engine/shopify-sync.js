import { prisma } from "../db.server";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-04";

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  apiVersion: LATEST_API_VERSION,
  isCustomStoreApp: true,
  scopes: process.env.SCOPES?.split(",") || [
    "read_products", "write_products", "read_inventory", "write_inventory",
    "read_orders", "write_orders", "read_metafields", "write_metafields",
  ],
  isEmbeddedApp: false,
  hostScheme: "https",
  hostName: process.env.SHOPIFY_APP_URL || "pes-engine.ngrok.io",
  restResources,
});

export async function syncShopifyProducts(session, limit = 250) {
  const client = new shopify.clients.Rest({ session });
  const products = [];
  let pageInfo = null;

  do {
    const response = await client.get({
      path: "products",
      query: { limit: String(limit), ...(pageInfo ? { page_info: pageInfo } : {}) },
    });

    products.push(...(response.body.products || []));
    pageInfo = response.body.page_info;
  } while (pageInfo);

  // Upsert into local cache
  for (const product of products) {
    await prisma.shopifyProduct.upsert({
      where: { shopifyId: String(product.id) },
      update: {
        title: product.title,
        handle: product.handle,
        sku: product.variants?.[0]?.sku || null,
        shopifyPrice: product.variants?.[0]?.price ? parseFloat(product.variants[0].price) : null,
        compareAtPrice: product.variants?.[0]?.compare_at_price ? parseFloat(product.variants[0].compare_at_price) : null,
        inventory: product.variants?.[0]?.inventory_quantity || 0,
        status: product.status,
        tags: JSON.stringify(product.tags || []),
        vendorName: product.vendor,
        productType: product.product_type,
        updatedAt: new Date(product.updated_at),
        lastSyncAt: new Date(),
        syncVersion: (product.variants?.[0]?.updated_at ? new Date(product.variants[0].updated_at).getTime() : Date.now()).toString(),
      },
      create: {
        shopifyId: String(product.id),
        title: product.title,
        handle: product.handle,
        sku: product.variants?.[0]?.sku || null,
        shopifyPrice: product.variants?.[0]?.price ? parseFloat(product.variants[0].price) : null,
        compareAtPrice: product.variants?.[0]?.compare_at_price ? parseFloat(product.variants[0].compare_at_price) : null,
        inventory: product.variants?.[0]?.inventory_quantity || 0,
        status: product.status,
        tags: JSON.stringify(product.tags || []),
        vendorName: product.vendor,
        productType: product.product_type,
        updatedAt: new Date(product.updated_at),
        lastSyncAt: new Date(),
        syncVersion: (product.variants?.[0]?.updated_at ? new Date(product.variants[0].updated_at).getTime() : Date.now()).toString(),
      },
    });
  }

  return { total: products.length, synced: products.length };
}

export async function updateShopifyMetafields(productId, metafields, session) {
  const client = new shopify.clients.Rest({ session });

  for (const metafield of metafields) {
    await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value,
          type: metafield.type || "single_line_text_field",
        },
      },
    });
  }

  return { updated: metafields.length };
}

export async function syncEOLToShopify(eolProduct, session) {
  const shopifyProduct = await prisma.shopifyProduct.findUnique({
    where: { sku: eolProduct.sku },
  });

  if (!shopifyProduct) return { status: "skipped", reason: "Not found in Shopify" };

  const metafields = [
    { namespace: "lifecycle", key: "status", value: "eol", type: "single_line_text_field" },
    { namespace: "lifecycle", key: "eol_strategy", value: eolProduct.eolStrategy || "legacy", type: "single_line_text_field" },
  ];

  if (eolProduct.replacementId) {
    const replacement = await prisma.vendorProduct.findUnique({
      where: { id: eolProduct.replacementId },
    });
    if (replacement) {
      metafields.push({
        namespace: "lifecycle",
        key: "replacement_handle",
        value: replacement.handle || replacement.sku,
        type: "single_line_text_field",
      });
    }
  }

  // Update compare-at price
  await updateShopifyProductPrice(shopifyProduct.shopifyId, {
    compare_at_price: eolProduct.msrp || eolProduct.mapPrice || null,
  }, session);

  await updateShopifyMetafields(shopifyProduct.shopifyId, metafields, session);

  return { status: "synced", metafields: metafields.length };
}

export async function updateShopifyProductPrice(productId, priceData, session) {
  const client = new shopify.clients.Rest({ session });

  await client.put({
    path: `products/${productId}`,
    data: {
      product: {
        variants: [{ price: priceData.price, compare_at_price: priceData.compare_at_price }],
      },
    },
  });

  return { updated: true };
}

export async function batchSyncEOLToShopify(eolProducts, session) {
  const results = [];

  for (const product of eolProducts) {
    try {
      const result = await syncEOLToShopify(product, session);
      results.push({ sku: product.sku, ...result });
    } catch (error) {
      results.push({ sku: product.sku, status: "error", error: error.message });
    }
  }

  return results;
}

export async function getGraphQLClient(session) {
  return new shopify.clients.Graphql({ session });
}

export async function getShopifyProductsByTag(tag, session, limit = 50) {
  const client = await getGraphQLClient(session);

  const query = `
    query getProductsByTag($tag: String!, $limit: Int!) {
      products(first: $limit, query: $tag) {
        edges {
          node {
            id
            title
            handle
            tags
            variants(first: 1) {
              edges {
                node {
                  sku
                  price
                  compareAtPrice
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await client.query({
    data: {
      query,
      variables: { tag: `tag:${tag}`, limit },
    },
  });

  return response.body.data.products.edges.map(edge => edge.node);
}

export async function createShopifyProduct(productData, session) {
  const client = new shopify.clients.Rest({ session });

  const response = await client.post({
    path: "products",
    data: {
      product: {
        title: productData.title,
        body_html: productData.description,
        vendor: productData.vendorName,
        product_type: productData.productType,
        tags: productData.tags || [],
        variants: [{
          sku: productData.sku,
          price: String(productData.price),
          compare_at_price: productData.compareAtPrice ? String(productData.compareAtPrice) : null,
          inventory_quantity: productData.inventory || 0,
        }],
      },
    },
  });

  return response.body.product;
}

export async function updateShopifyProduct(productId, updates, session) {
  const client = new shopify.clients.Rest({ session });

  const response = await client.put({
    path: `products/${productId}`,
    data: {
      product: updates,
    },
  });

  return response.body.product;
}

export async function deleteShopifyProduct(productId, session) {
  const client = new shopify.clients.Rest({ session });

  await client.delete({
    path: `products/${productId}`,
  });

  return { deleted: true };
}

export { shopify };
