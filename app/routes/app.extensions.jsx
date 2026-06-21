import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Button, Badge, Banner,
  Tabs, InlineStack, Box, Grid, DataTable,
} from "@shopify/polaris";
import {
  PackageIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ArrowPathIcon, ExternalIcon, PlayIcon, PauseIcon,
} from "@shopify/polaris-icons";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const extensions = await prisma.themeExtension.findMany({
    orderBy: { createdAt: "desc" },
  });
  
  return json({ extensions });
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const extensionId = formData.get("extensionId");
  
  if (action === "deploy") {
    await prisma.themeExtension.update({
      where: { id: extensionId },
      data: { isInstalled: true, updatedAt: new Date() },
    });
    return { status: "deployed", message: "Extension deployed" };
  }
  
  if (action === "undeploy") {
    await prisma.themeExtension.update({
      where: { id: extensionId },
      data: { isInstalled: false, updatedAt: new Date() },
    });
    return { status: "undeployed", message: "Extension undeployed" };
  }
  
  return { status: "unknown" };
};

export default function ExtensionsPage() {
  const { extensions } = useLoaderData();
  const fetcher = useFetcher();
  
  const extensionRows = extensions.map(e => [
    e.name,
    e.handle,
    <Badge tone={e.isInstalled ? "success" : "warning"}>
      {e.isInstalled ? "Installed" : "Not Installed"}
    </Badge>,
    e.blockType || "—",
    e.target || "product",
    <Button
      size="slim"
      icon={e.isInstalled ? PauseIcon : PlayIcon}
      onClick={() => {
        fetcher.submit(
          { action: e.isInstalled ? "undeploy" : "deploy", extensionId: e.id },
          { method: "post" }
        );
      }}
    >
      {e.isInstalled ? "Undeploy" : "Deploy"}
    </Button>,
  ]);
  
  const installed = extensions.filter(e => e.isInstalled).length;
  
  return (
    <Page
      title="Theme Extensions"
      subtitle="Manage Shopify theme app extensions: EOL banners, comparison tables, urgency badges, spec sheets, cross-sell carousels"
      primaryAction={
        <Button
          variant="primary"
          icon={ArrowPathIcon}
          onClick={() => window.location.reload()}
        >
          Refresh Status
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Banner
            tone={installed === extensions.length ? "success" : "warning"}
          >
            <p>
              {installed} of {extensions.length} extensions installed on the storefront.
              {installed < extensions.length && ` ${extensions.length - installed} extensions need to be deployed.`}
            </p>
          </Banner>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text", "text"]}
              headings={["Name", "Handle", "Status", "Block Type", "Target", "Action"]}
              rows={extensionRows}
            />
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Grid columns={{ xs: 1, sm: 2, md: 2, lg: 2, xl: 2 }} gap="4">
            <Card>
              <Box padding="4">
                <Text as="h2" variant="headingMd">Extension Coverage</Text>
                <Box paddingBlockStart="3">
                  <Text as="p" variant="heading2xl">{Math.round((installed / extensions.length) * 100)}%</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{installed}/{extensions.length} extensions active</Text>
                </Box>
              </Box>
            </Card>
            
            <Card>
              <Box padding="4">
                <Text as="h2" variant="headingMd">Metafield Integration</Text>
                <Box paddingBlockStart="3">
                  <Text as="p" variant="bodyMd">Extensions read from product metafields:</Text>
                  <Text as="p" variant="bodySm" tone="subdued">lifecycle.*, specs.*, cross_sell.*</Text>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
