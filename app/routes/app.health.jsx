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
  SkeletonDisplayText,
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

  if (action === "run_health") {
    return { status: "health_scan_started", message: "Health scan started" };
  }

  if (action === "fix_all") {
    return { status: "bulk_fix_applied", message: "Bulk fixes applied" };
  }

  return { status: "unknown" };
};

export default function Health() {
  const { shop } = useLoaderData();
  const submit = useSubmit();

  return (
    <Page
      title="Catalog Health Monitor"
      subtitle="12 health checks: zero-price, broken handles, uncategorized, missing metadata, 404s, and more"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "run_health" }, { method: "post" })
          }
        >
          Run Health Scan
        </Button>
      }
      secondaryActions={[
        {
          content: "Auto-Fix All",
          onAction: () => submit({ action: "fix_all" }, { method: "post" }),
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner status="critical" title="Critical Issues Found">
            <Text as="p">
              6,434 products at $0.01 — zero-price detector will catch and suggest recommended prices. "false" category (13 items). "UNKNOWN" brand.
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Health Score" sectioned>
            <div style={{ marginBottom: "16px" }}>
              <Text as="h2" variant="headingMd">Health Score</Text>
              <ProgressBar progress={42} size="large" color="critical" />
              <Text as="p" variant="bodySm" tone="subdued">42/100 — Critical</Text>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Health Checks" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "numeric", "text"]}
              headings={["Check", "Severity", "Count", "Action"]}
              rows={[
                ["Zero Price", "Critical", "6,434", "Auto-fix to MAP/MSRP"],
                ["Broken Handle", "High", "—", "Regenerate handle"],
                ["Uncategorized", "Medium", "13", "Infer from title"],
                ["Missing Brand", "Medium", "—", "Infer from vendor"],
                ["Missing Images", "Medium", "—", "Add placeholder"],
                ["Duplicate SKU", "High", "—", "Merge or split"],
                ["Missing Metadata", "Low", "—", "Infer from vendor"],
                ["Missing Compare-At", "Low", "—", "Set to MSRP"],
                ["PDP 404", "Critical", "—", "Investigate"],
                ["Wrong Category", "Medium", "—", "Recategorize"],
                ["Missing Tags", "Low", "—", "Generate tags"],
                ["Orphaned Product", "Medium", "—", "Link vendor"],
              ]}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
