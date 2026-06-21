import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

/**
 * Shopify Webhook Handlers — PES Engine
 * Processes Shopify webhooks for product/inventory/order changes
 */

export async function action({ request }) {
  const { topic, shop, session } = await authenticate.webhook(request);
  
  console.log(`[Webhook] Received: ${topic} for ${shop}`);
  
  try {
    const payload = await request.json();
    
    switch (topic) {
      case "products/create":
        return await handleProductCreate(payload);
      case "products/update":
        return await handleProductUpdate(payload);
      case "products/delete":
        return await handleProductDelete(payload);
      case "inventory_levels/update":
        return await handleInventoryUpdate(payload);
      case "inventory_levels/create":
        return await handleInventoryUpdate(payload);
      case "orders/create":
        return await handleOrderCreate(payload);
      case "orders/updated":
        return await handleOrderUpdate(payload);
      case "orders/cancelled":
        return await handleOrderCancelled(payload);
      case "collections/create":
        return await handleCollectionCreate(payload);
      case "collections/update":
        return await handleCollectionUpdate(payload);
      case "collections/delete":
        return await handleCollectionDelete(payload);
      case "metafields/create":
      case "metafields/update":
        return await handleMetafieldChange(payload);
      case "app/uninstalled":
        return await handleAppUninstalled(shop);
      case "app/scopes_update":
        return await handleScopesUpdate(payload);
      default:
        console.log(`[Webhook] Unhandled topic: ${topic}`);
        return json({ success: true, message: "Unhandled topic" });
    }
  } catch (error) {
    console.error(`[Webhook] Error processing ${topic}:`, error.message);
    return json({ error: error.message }, { status: 500 });
  }
}

async function handleProductCreate(payload) {
  const product = payload;
  const variant = product.variants?.[0] || {};
  
  await prisma.shopifyProduct.upsert({
    where: { shopifyId: `gid://shopify/Product/${product.id}` },
    update: {
      shopifyHandle: product.handle,
      title: product.title,
      sku: variant.sku || null,
      vendor: product.vendor || null,
      price: variant.price ? parseFloat(variant.price) : null,
      compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
      productType: product.product_type || null,
      tags: product.tags?.join(",") || null,
      description: product.body_html || null,
      status: product.status,
      images: JSON.stringify((product.images || []).map(i => i.src)),
      imageCount: (product.images || []).length,
      metafields: JSON.stringify(product.metafields || []),
      lastSyncAt: new Date(),
    },
    create: {
      shopifyId: `gid://shopify/Product/${product.id}`,
      shopifyHandle: product.handle,
      title: product.title,
      sku: variant.sku || null,
      vendor: product.vendor || null,
      price: variant.price ? parseFloat(variant.price) : null,
      compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
      productType: product.product_type || null,
      tags: product.tags?.join(",") || null,
      description: product.body_html || null,
      status: product.status,
      images: JSON.stringify((product.images || []).map(i => i.src)),
      imageCount: (product.images || []).length,
      metafields: JSON.stringify(product.metafields || []),
      lastSyncAt: new Date(),
    },
  });
  
  // Try to match with vendor product
  if (variant.sku) {
    await prisma.vendorProduct.updateMany({
      where: { sku: { equals: variant.sku, mode: "insensitive" } },
      data: {
        inShopify: true,
        shopifyProductId: `gid://shopify/Product/${product.id}`,
        shopifyProductHandle: product.handle,
        shopifyProductTitle: product.title,
        shopifyPrice: variant.price ? parseFloat(variant.price) : null,
      },
    });
  }
  
  console.log(`[Webhook] Product created: ${product.title} (ID: ${product.id})`);
  return json({ success: true });
}

async function handleProductUpdate(payload) {
  const product = payload;
  const variant = product.variants?.[0] || {};
  
  await prisma.shopifyProduct.update({
    where: { shopifyId: `gid://shopify/Product/${product.id}` },
    data: {
      shopifyHandle: product.handle,
      title: product.title,
      sku: variant.sku || null,
      vendor: product.vendor || null,
      price: variant.price ? parseFloat(variant.price) : null,
      compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
      productType: product.product_type || null,
      tags: product.tags?.join(",") || null,
      description: product.body_html || null,
      status: product.status,
      images: JSON.stringify((product.images || []).map(i => i.src)),
      imageCount: (product.images || []).length,
      metafields: JSON.stringify(product.metafields || []),
      lastSyncAt: new Date(),
    },
  });
  
  console.log(`[Webhook] Product updated: ${product.title} (ID: ${product.id})`);
  return json({ success: true });
}

async function handleProductDelete(payload) {
  const { id } = payload;
  
  await prisma.shopifyProduct.delete({
    where: { shopifyId: `gid://shopify/Product/${id}` },
  }).catch(() => {
    // Product may not exist in cache
  });
  
  await prisma.vendorProduct.updateMany({
    where: { shopifyProductId: `gid://shopify/Product/${id}` },
    data: {
      inShopify: false,
      shopifyProductId: null,
      shopifyProductHandle: null,
      shopifyProductTitle: null,
      shopifyPrice: null,
    },
  });
  
  console.log(`[Webhook] Product deleted: ${id}`);
  return json({ success: true });
}

async function handleInventoryUpdate(payload) {
  const { inventory_item_id, available, location_id } = payload;
  
  // Find Shopify product by inventory item
  // This requires mapping inventory_item_id to variant
  console.log(`[Webhook] Inventory updated: item ${inventory_item_id}, available: ${available}`);
  
  return json({ success: true });
}

async function handleOrderCreate(payload) {
  const order = payload;
  
  // Log order for margin analytics
  await prisma.auditLog.create({
    data: {
      userId: "webhook",
      action: "order_create",
      entityType: "order",
      entityId: String(order.id),
      newValue: JSON.stringify({
        total: order.total_price,
        lineItems: order.line_items?.length || 0,
        customer: order.customer?.email || "guest",
      }),
    },
  });
  
  console.log(`[Webhook] Order created: ${order.name} (ID: ${order.id})`);
  return json({ success: true });
}

async function handleOrderUpdate(payload) {
  console.log(`[Webhook] Order updated: ${payload.id}`);
  return json({ success: true });
}

async function handleOrderCancelled(payload) {
  console.log(`[Webhook] Order cancelled: ${payload.id}`);
  return json({ success: true });
}

async function handleCollectionCreate(payload) {
  console.log(`[Webhook] Collection created: ${payload.title} (ID: ${payload.id})`);
  return json({ success: true });
}

async function handleCollectionUpdate(payload) {
  console.log(`[Webhook] Collection updated: ${payload.title} (ID: ${payload.id})`);
  return json({ success: true });
}

async function handleCollectionDelete(payload) {
  console.log(`[Webhook] Collection deleted: ${payload.id}`);
  return json({ success: true });
}

async function handleMetafieldChange(payload) {
  const { owner_id, namespace, key, value, owner_resource } = payload;
  
  if (owner_resource === "product") {
    // Update our local cache of metafields
    const product = await prisma.shopifyProduct.findUnique({
      where: { shopifyId: `gid://shopify/Product/${owner_id}` },
    });
    
    if (product) {
      let metafields = [];
      try {
        metafields = JSON.parse(product.metafields || "[]");
      } catch (e) {
        metafields = [];
      }
      
      // Update or add metafield
      const existingIndex = metafields.findIndex(
        m => m.namespace === namespace && m.key === key
      );
      
      if (existingIndex >= 0) {
        metafields[existingIndex].value = value;
      } else {
        metafields.push({ namespace, key, value });
      }
      
      await prisma.shopifyProduct.update({
        where: { shopifyId: `gid://shopify/Product/${owner_id}` },
        data: {
          metafields: JSON.stringify(metafields),
          lastSyncAt: new Date(),
        },
      });
      
      // Update lifecycle status if metafield is lifecycle-related
      if (namespace === "lifecycle" && key === "status") {
        await prisma.shopifyProduct.update({
          where: { shopifyId: `gid://shopify/Product/${owner_id}` },
          data: { lifecycleStatus: value },
        });
      }
      
      if (namespace === "lifecycle" && key === "eol_strategy") {
        await prisma.shopifyProduct.update({
          where: { shopifyId: `gid://shopify/Product/${owner_id}` },
          data: { eolStrategy: value },
        });
      }
    }
  }
  
  console.log(`[Webhook] Metafield changed: ${namespace}.${key} on ${owner_resource} ${owner_id}`);
  return json({ success: true });
}

async function handleAppUninstalled(shop) {
  console.log(`[Webhook] App uninstalled from ${shop}`);
  
  // Clean up session data if needed
  // Note: PrismaSessionStorage handles this automatically via Shopify App Remix
  
  return json({ success: true });
}

async function handleScopesUpdate(payload) {
  console.log(`[Webhook] Scopes updated: ${JSON.stringify(payload)}`);
  return json({ success: true });
}
