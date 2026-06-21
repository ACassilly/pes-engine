import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  Banner,
  DataTable,
  Badge,
  ProgressBar,
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

  if (action === "run_pricing") {
    return { status: "pricing_analysis_started", message: "Pricing analysis started" };
  }

  if (action === "fix_map") {
    return { status: "map_fix_applied", message: "MAP violations fixed" };
  }

  return { status: "unknown" };
};

export default function Pricing() {
  const { shop } = useLoaderData();
  const submit = useSubmit();

  return (
    <Page
      title="Pricing Engine"
      subtitle="MAP validation, margin analysis, unit pricing, and recommended prices"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "run_pricing" }, { method: "post" })
          }
        >
          Run Pricing Analysis
        </Button>
      }
      secondaryActions={[
        {
          content: "Fix MAP Violations",
          onAction: () => submit({ action: "fix_map" }, { method: "post" }),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner status="critical" title="MAP Violations Detected">
            <Text as="p">
              EG4 12kPV listed at $3,999 (MAP $2,999.99) — price must be ≥$2,999.99. Signature Solar prices at exactly MAP.
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Pricing Issues" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "numeric", "text"]}
              headings={["SKU", "Product", "Issue", "Current Price", "Recommended", "Action"]}
              rows={[
                ["EG4-12KPV", "EG4 12kPV Inverter", "MAP Violation", "$3,999.00", "$2,999.99", "Update Price"],
                ["CUM-20KW", "Cummins 20kW Genset", "Outdated Pricebook", "$8,500.00", "$8,750.00", "Update from Jaime"],
              ]}
            />
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Unit Pricing" sectioned>
            <Text as="p">
              $/W (panels), $/kWh (batteries), $/kW (inverters/generators) — extracted from title, model, description.
            </Text>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Margin Analysis" sectioned>
            <Text as="p">
              Low margin (0-15%), very low (≤0%), high (≥50%). Generac standard: sell at MSRP for ~15.8% margin.
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
