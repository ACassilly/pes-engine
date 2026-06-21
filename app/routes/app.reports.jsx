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
  Select,
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

  if (action === "generate_report") {
    return { status: "report_generated", message: "Report generated", downloadUrl: "/reports/pricing-audit.csv" };
  }

  return { status: "unknown" };
};

export default function Reports() {
  const { shop } = useLoaderData();
  const submit = useSubmit();

  const reportOptions = [
    { label: "Pricing Audit", value: "pricing_audit" },
    { label: "EOL Audit", value: "eol_audit" },
    { label: "Catalog Health", value: "catalog_health" },
    { label: "Competitor Gap", value: "competitor_gap" },
    { label: "Vendor Sync", value: "vendor_sync" },
  ];

  const formatOptions = [
    { label: "JSON", value: "json" },
    { label: "CSV", value: "csv" },
  ];

  return (
    <Page
      title="Report Engine"
      subtitle="Generate and export pricing audit, EOL audit, health reports, and competitor gap analysis"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "generate_report" }, { method: "post" })
          }
        >
          Generate Report
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card title="Report Configuration" sectioned>
            <Form method="post">
              <Select label="Report Type" options={reportOptions} name="report_type" />
              <Select label="Format" options={formatOptions} name="format" />
              <Button submit variant="primary">
                Generate & Download
              </Button>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Recent Reports" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["Report", "Type", "Format", "Generated", "Status"]}
              rows={[
                ["Pricing Audit — May 2026", "Pricing", "CSV", "2026-05-01", "Ready"],
                ["EOL Audit — May 2026", "EOL", "JSON", "2026-05-01", "Ready"],
              ]}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
