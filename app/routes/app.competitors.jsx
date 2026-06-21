import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  Banner,
  DataTable,
  Badge,
  Form,
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

  if (action === "import_competitors") {
    return { status: "competitors_imported", message: "Competitor data imported" };
  }

  if (action === "run_gap") {
    return { status: "gap_analysis_started", message: "Gap analysis started" };
  }

  return { status: "unknown" };
};

export default function Competitors() {
  const { shop } = useLoaderData();
  const submit = useSubmit();

  return (
    <Page
      title="Competitor Intelligence"
      subtitle="Gap analysis, price comparison, and market positioning"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "run_gap" }, { method: "post" })
          }
        >
          Run Gap Analysis
        </Button>
      }
      secondaryActions={[
        {
          content: "Import CSV",
          onAction: () => submit({ action: "import_competitors" }, { method: "post" }),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner status="info" title="Airgap Mode">
            <Text as="p">
              Competitor data is imported via CSV only (no external scraping). Upload CSV files from Signature Solar, Solar Sovereign, or other competitors.
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Import Competitor Data" sectioned>
            <Form method="post" encType="multipart/form-data">
              <input type="file" name="competitor_csv" accept=".csv" />
              <select name="competitor">
                <option value="signature_solar">Signature Solar</option>
                <option value="solar_sovereign">Solar Sovereign</option>
                <option value="wholesale_solar">Wholesale Solar</option>
                <option value="solar_electric_supply">Solar Electric Supply</option>
                <option value="alt_energy_store">Alt Energy Store</option>
              </select>
              <Button submit variant="primary">
                Import
              </Button>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Price Comparison" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "numeric", "numeric", "numeric", "text"]}
              headings={["SKU", "Product", "PES Price", "Competitor", "Diff", "Status"]}
              rows={[
                ["EG4-12KPV", "EG4 12kPV", "$2,999.99", "Signature Solar", "$0.00", "Competitive"],
                ["GEN-26KW", "Generac 26kW", "$7,500", "Competitor A", "+$200", "Higher"],
              ]}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
