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

  if (action === "upload_spec") {
    return { status: "spec_uploaded", message: "Specification document uploaded" };
  }

  return { status: "unknown" };
};

export default function Manufacturers() {
  const { shop } = useLoaderData();
  const submit = useSubmit();

  return (
    <Page
      title="Manufacturer Spec Linker"
      subtitle="Upload PDFs (datasheets, manuals, warranties) and link to Shopify metafields"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "upload_spec" }, { method: "post" })
          }
        >
          Upload Spec Sheet
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Banner status="info" title="Supported Document Types">
            <Text as="p">
              Datasheets, Installation Manuals, Warranty Documents, User Guides, Quick Start Guides, Compliance Certificates
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Upload Document" sectioned>
            <Form method="post" encType="multipart/form-data">
              <input type="file" name="spec" accept=".pdf" />
              <select name="type">
                <option value="datasheet">Datasheet</option>
                <option value="manual">Manual</option>
                <option value="warranty">Warranty</option>
                <option value="install_guide">Install Guide</option>
                <option value="compliance">Compliance Cert</option>
                <option value="quick_start">Quick Start</option>
              </select>
              <input type="text" name="sku" placeholder="Product SKU" />
              <Button submit variant="primary">
                Upload & Link
              </Button>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Linked Documents" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["SKU", "Type", "Title", "Version", "Linked"]}
              rows={[
                ["GEN-26KW", "Datasheet", "Generac 26kW Spec Sheet", "v2.1", "✓"],
                ["CUM-20KW", "Manual", "Cummins 20kW Install Guide", "v1.0", "✓"],
              ]}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
