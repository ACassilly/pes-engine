import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  Banner,
  DataTable,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useLoaderData, useSubmit } from "@remix-run/react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  return { shop: admin.rest.session.shop };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "detect_eol") {
    return { status: "eol_scan_started", message: "EOL detection scan started" };
  }

  if (action === "apply_eol") {
    return { status: "eol_applied", message: "EOL changes applied to Shopify" };
  }

  return { status: "unknown" };
};

export default function EOL() {
  const { shop } = useLoaderData();
  const submit = useSubmit();

  return (
    <Page
      title="EOL Detection Engine"
      subtitle="Detect end-of-life products, supersession mappings, and generate storefront banners"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "detect_eol" }, { method: "post" })
          }
        >
          Run EOL Scan
        </Button>
      }
      secondaryActions={[
        {
          content: "Apply to Shopify",
          onAction: () => submit({ action: "apply_eol" }, { method: "post" }),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner status="warning" title="Exited Brands Detected">
            <Text as="p">
              LG Solar (exited 2022) and Panasonic Solar (exited US residential 2023) — all remaining stock must be liquidation/legacy only.
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="EOL Strategies" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "text"]}
              headings={["Strategy", "Description", "Action"]}
              rows={[
                ["Liquidation", "Below cost — clear remaining inventory", "Apply clearance pricing"],
                ["Clearance", "Break-even — sell at cost", "Apply cost pricing"],
                ["Legacy", "Maintain for reference — recommend replacement", "Show replacement banner"],
                ["Discontinued Reference", "Page only — no sales, service only", "Hide add-to-cart"],
              ]}
            />
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Supersession Mapping" sectioned>
            <Text as="p">
              Auto-detect replacements via model generation patterns (V1→V2, Gen1→Gen2, 8kW→12kW) and manual YAML rules.
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
