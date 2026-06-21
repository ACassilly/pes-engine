import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, DataTable, Text, Button, Badge, Banner,
  Tabs, Modal, Select, InlineStack, Box, Pagination,
} from "@shopify/polaris";
import {
  PackageIcon, ArrowPathIcon, UploadIcon, CheckCircleIcon,
  AlertTriangleIcon, ArrowRightIcon, FilterIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "products";
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 50;
  
  const products = await prisma.shopifyProduct.findMany({
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
  
  const totalProducts = await prisma.shopifyProduct.count();
  
  const missing = await prisma.vendorProduct.findMany({
    where: { inShopify: false },
    include: { vendor: true },
    take: 50,
  });
  
  return json({ products, totalProducts, missing, page, perPage, tab });
};

export default function CatalogPage() {
  const { products, totalProducts, missing, page, perPage, tab } = useLoaderData();
  const fetcher = useFetcher();
  
  const [selectedTab, setSelectedTab] = useState(tab);
  
  const tabs = [
    { id: "products", content: "Products", accessibilityLabel: "Shopify Products" },
    { id: "missing", content: `Missing (${missing.length})`, accessibilityLabel: "Missing Products" },
  ];
  
  const productRows = products.map(p => [
    p.shopifyId.substring(0, 12),
    p.sku || "—",
    p.title.substring(0, 60),
    <Badge tone={p.status === "active" ? "success" : p.status === "draft" ? "warning" : "critical"}>
      {p.status}
    </Badge>,
    `$${p.price?.toFixed(2) || "—"}`,
    p.productType || "—",
    p.vendor || "—",
  ]);
  
  const missingRows = missing.map(m => [
    m.sku,
    m.title || m.model || "—",
    m.vendor?.name || "—",
    m.category || "—",
    `$${m.mapPrice?.toFixed(2) || "—"}`,
    `$${m.msrp?.toFixed(2) || "—"}`,
    <Button size="slim" icon={UploadIcon}>Import</Button>,
  ]);
  
  return (
    <Page
      title="Catalog Manager"
      subtitle="View and manage Shopify products, missing items, and catalog sync"
    >
      <Layout>
        <Layout.Section>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p">{totalProducts} products in Shopify catalog</Text>
            <Button icon={ArrowPathIcon} onClick={() => window.location.reload()}>Refresh</Button>
          </InlineStack>
        </Layout.Section>
        
        <Layout.Section>
          <Tabs tabs={tabs} selected={tabs.findIndex(t => t.id === selectedTab)} onSelect={(i) => setSelectedTab(tabs[i].id)}>
            {selectedTab === "products" && (
              <Card>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
                  headings={["Shopify ID", "SKU", "Title", "Status", "Price", "Type", "Vendor"]}
                  rows={productRows}
                  footerContent={
                    <Pagination
                      hasPrevious={page > 1}
                      hasNext={page * perPage < totalProducts}
                      onPrevious={() => window.location.href = `?tab=products&page=${page - 1}`}
                      onNext={() => window.location.href = `?tab=products&page=${page + 1}`}
                    />
                  }
                />
              </Card>
            )}
            
            {selectedTab === "missing" && (
              <Card>
                <Banner tone="warning">
                  <p>{missing.length} products found in vendor catalogs but not in Shopify. These may need to be imported or may be intentionally excluded.</p>
                </Banner>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
                  headings={["SKU", "Title", "Vendor", "Category", "MAP Price", "MSRP", "Action"]}
                  rows={missingRows}
                />
              </Card>
            )}
          </Tabs>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
