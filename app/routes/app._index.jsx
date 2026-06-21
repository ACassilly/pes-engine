import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, InlineStack, Box, Badge, Grid, Button, Stack, Banner, Icon } from "@shopify/polaris";
import { HomeIcon, ArrowRightIcon, AlertTriangleIcon, CheckCircleIcon, TrendingUpIcon, PackageIcon, PriceTagIcon, ArrowPathIcon, ShieldCheckIcon, ChartBarIcon, ExclamationTriangleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const stats = await prisma.$transaction([
    prisma.vendor.count({ where: { isActive: true } }),
    prisma.vendorProduct.count(),
    prisma.vendorProduct.count({ where: { inShopify: false } }),
    prisma.vendorProduct.count({ where: { lifecycle: "active" } }),
    prisma.vendorProduct.count({ where: { lifecycle: { in: ["legacy", "clearance", "liquidation", "discontinued_reference"] } } }),
    prisma.shopifyProduct.count(),
    prisma.shopifyProduct.count({ where: { status: "active" } }),
    prisma.shopifyProduct.count({ where: { status: "draft" } }),
    prisma.healthIssue.count({ where: { status: "open" } }),
    prisma.healthIssue.count({ where: { status: "open", severity: "critical" } }),
    prisma.healthIssue.count({ where: { status: "open", severity: "high" } }),
    prisma.eolMapping.count({ where: { isActive: true } }),
    prisma.competitor.count({ where: { isActive: true } }),
    prisma.competitorProduct.count({ where: { isActive: true } }),
    prisma.manufacturerSpec.count({ where: { isLocal: true } }),
    prisma.themeExtension.count({ where: { isActive: true } }),
    prisma.themeExtension.count({ where: { isActive: true, isInstalled: true } }),
  ]);
  const healthScore = 100;
  const catalogCoverage = 100;
  return json({ stats: { activeVendors: stats[0], totalVendorProducts: stats[1], missingFromShopify: stats[2], activeProducts: stats[3], eolProducts: stats[4], totalShopifyProducts: stats[5], activeShopifyProducts: stats[6], draftShopifyProducts: stats[7], openHealthIssues: stats[8], criticalIssues: stats[9], highIssues: stats[10], activeEolMappings: stats[11], activeCompetitors: stats[12], competitorProducts: stats[13], localSpecs: stats[14], activeExtensions: stats[15], installedExtensions: stats[16], healthScore, catalogCoverage, themeExtensionCoverage: stats[15] > 0 ? Math.round((stats[16] / stats[15]) * 100) : 0, }, recentActivity: { newProducts: 0, newIssues: 0, auditActions: 0, priceChanges: 0 }, airgapMode: false, appVersion: "1.0.0" });
};

export default function AppIndex() { const { stats, recentActivity, airgapMode, appVersion } = useLoaderData(); const statCards = [{ title: "Vendor Catalogs", value: stats.activeVendors, subtitle: `${stats.totalVendorProducts} products tracked`, icon: PackageIcon, link: "/app/vendors", linkText: "Manage Vendors" }, { title: "Shopify Products", value: stats.totalShopifyProducts, subtitle: `${stats.activeShopifyProducts} active`, icon: HomeIcon, link: "/app/catalog", linkText: "View Catalog" }, { title: "Missing Products", value: stats.missingFromShopify, subtitle: `${stats.catalogCoverage}% coverage`, icon: AlertTriangleIcon, link: "/app/catalog", linkText: "Find Missing" }, { title: "Health Score", value: `${stats.healthScore}/100`, subtitle: `${stats.openHealthIssues} open issues`, icon: stats.healthScore >= 80 ? CheckCircleIcon : stats.healthScore >= 50 ? ExclamationTriangleIcon : AlertTriangleIcon, link: "/app/health", linkText: "View Health" }, { title: "EOL Products", value: stats.eolProducts, subtitle: `${stats.activeEolMappings} mappings`, icon: ArrowPathIcon, link: "/app/eol", linkText: "Manage EOL" }, { title: "Competitors", value: stats.activeCompetitors, subtitle: `${stats.competitorProducts} tracked`, icon: TrendingUpIcon, link: "/app/competitors", linkText: "View Intel" }]; const quickActions = [{ label: "Sync Vendor Catalogs", url: "/app/vendors", icon: ArrowPathIcon }, { label: "Run Health Scan", url: "/app/health", icon: ShieldCheckIcon }, { label: "Detect EOL Products", url: "/app/eol", icon: ArrowPathIcon }, { label: "Pricing Analysis", url: "/app/pricing", icon: PriceTagIcon }, { label: "Generate Reports", url: "/app/reports", icon: ChartBarIcon }, { label: "Theme Extensions", url: "/app/extensions", icon: PackageIcon }]; return (<Page title="PES Engine Admin"><Layout><Layout.Section><Card><Box padding="4"><Text variant="headingLg">PES Engine — Portlandia Unified Commerce Engine</Text><Box paddingBlockStart="2"><Text tone="subdued">Manage vendor catalogs, pricing, EOL products, health monitoring, and storefront extensions.</Text></Box></Box></Card></Layout.Section><Layout.Section><Grid columns={{ xs: 2, sm: 3, md: 3, lg: 3, xl: 3 }} gap="4">{statCards.map((card, i) => (<Card key={i}><Box padding="4"><Text variant="headingMd">{card.title}</Text><Box paddingBlockStart="3"><Text variant="heading2xl">{card.value}</Text></Box><Box paddingBlockStart="1"><Text tone="subdued" variant="bodySm">{card.subtitle}</Text></Box><Box paddingBlockStart="3"><Button url={card.link} icon={ArrowRightIcon} variant="plain">{card.linkText}</Button></Box></Box></Card>))}</Grid></Layout.Section><Layout.Section><Card><Box padding="4"><Text variant="headingMd">Quick Links</Text><Box paddingBlockStart="3"><InlineStack gap="2" wrap><a href="/app/vendors">Vendor Catalog Sync</a><a href="/app/eol">EOL Engine</a><a href="/app/pricing">Pricing & MAP</a><a href="/app/health">Health Monitor</a><a href="/app/catalog">Catalog Manager</a><a href="/app/competitors">Competitors</a><a href="/app/reports">Reports</a><a href="/app/extensions">Theme Extensions</a><a href="/app/settings">Settings</a></InlineStack></Box></Box></Card></Layout.Section></Layout></Page>); }
