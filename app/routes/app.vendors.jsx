import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  Banner,
  DataTable,
  SkeletonPage,
  SkeletonBodyText,
  useToast,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useLoaderData, useSubmit, Form } from "@remix-run/react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  return { shop: admin.rest.session.shop };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "sync") {
    // Trigger vendor sync
    return { status: "sync_started", message: "Vendor sync started" };
  }

  return { status: "unknown" };
};

export default function Vendors() {
  const { shop } = useLoaderData();
  const submit = useSubmit();
  const toast = useToast();

  return (
    <Page
      title="Vendor Catalog Sync"
      subtitle="Auto-detect and sync vendor pricebooks (PDF, Excel, CSV)"
      primaryAction={
        <Button
          variant="primary"
          onClick={() =>
            submit({ action: "sync" }, { method: "post" })
          }
        >
          Sync Now
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Banner status="info" title="Supported Vendors">
            <Text as="p">
              Generac, Cummins, EG4, Enphase, SolarEdge, SMA, Fronius, Sol-Ark, Victron, Jinko, Trina, Canadian Solar, REC, LG Solar, Panasonic, Q Cells
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Upload Pricebook" sectioned>
            <Form method="post" encType="multipart/form-data">
              <input type="file" name="pricebook" accept=".pdf,.xlsx,.xls,.csv" />
              <Button submit variant="primary">
                Upload & Parse
              </Button>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Vendor Directory" sectioned>
            <DataTable
              columnContentTypes={["text", "text", "text", "numeric", "text"]}
              headings={["Vendor", "Contact", "Portal", "Products", "Last Sync"]}
              rows={[
                ["Generac", "Jennifer Weiss / Spencer Warmuth", "generac.com/whs-gold", "—", "—"],
                ["Cummins", "Jaime Gilmore", "cummins.com/dealer-portal", "—", "—"],
                ["EG4", "Anthony Dawood", "eg4electronics.com/dealer", "—", "—"],
              ]}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
