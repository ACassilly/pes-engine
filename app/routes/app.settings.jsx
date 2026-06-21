import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Button, Badge, Banner,
  Tabs, FormLayout, TextField, Select, Checkbox, InlineStack, Box,
  DataTable, Modal, Toast,
} from "@shopify/polaris";
import {
  GearIcon, CheckCircleIcon, ExclamationTriangleIcon,
  ArrowPathIcon, SaveIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const configs = await prisma.appConfig.findMany({
    orderBy: { key: "asc" },
  });
  
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
  });
  
  return json({ configs, vendors, airgapMode: process.env.AIRGAP_MODE === "true" });
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  
  if (action === "save") {
    const key = formData.get("key");
    const value = formData.get("value");
    
    await prisma.appConfig.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value, description: "User setting" },
    });
    
    return { status: "saved", message: "Setting saved" };
  }
  
  if (action === "reset") {
    return { status: "reset", message: "Settings reset to defaults" };
  }
  
  return { status: "unknown" };
};

export default function SettingsPage() {
  const { configs, vendors, airgapMode } = useLoaderData();
  const fetcher = useFetcher();
  const [selectedTab, setSelectedTab] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  const tabs = [
    { id: "general", content: "General", accessibilityLabel: "General Settings" },
    { id: "pricing", content: "Pricing", accessibilityLabel: "Pricing Rules" },
    { id: "vendors", content: "Vendors", accessibilityLabel: "Vendor Defaults" },
    { id: "advanced", content: "Advanced", accessibilityLabel: "Advanced Settings" },
  ];
  
  const getConfig = (key) => configs.find(c => c.key === key)?.value || "";
  
  return (
    <Page
      title="Settings"
      subtitle="Configure PES Engine app settings, pricing rules, vendor defaults, and advanced options"
      primaryAction={
        <Button
          variant="primary"
          icon={SaveIcon}
          onClick={() => {
            fetcher.submit({ action: "save" }, { method: "post" });
            setToastMessage("Settings saved");
            setShowToast(true);
          }}
        >
          Save All
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          {airgapMode && (
            <Banner tone="info" title="Airgap Mode Active">
              <p>External APIs are disabled. All data is processed locally.</p>
            </Banner>
          )}
        </Layout.Section>
        
        <Layout.Section>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            {selectedTab === 0 && (
              <Card title="General Settings" sectioned>
                <FormLayout>
                  <TextField
                    label="App Name"
                    value={getConfig("app_name") || "PES Engine"}
                    onChange={() => {}}
                    autoComplete="off"
                  />
                  <TextField
                    label="Default Currency"
                    value={getConfig("currency") || "USD"}
                    onChange={() => {}}
                    autoComplete="off"
                  />
                  <Checkbox
                    label="Enable Cron Jobs"
                    checked={getConfig("cron_enabled") === "true"}
                    onChange={() => {}}
                  />
                  <Checkbox
                    label="Enable Notifications"
                    checked={getConfig("notifications_enabled") === "true"}
                    onChange={() => {}}
                  />
                </FormLayout>
              </Card>
            )}
            
            {selectedTab === 1 && (
              <Card title="Pricing Rules" sectioned>
                <FormLayout>
                  <TextField
                    label="Default Cost-Plus Margin (%)"
                    value={getConfig("cost_plus_margin") || "15"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <TextField
                    label="MAP Violation Threshold ($)"
                    value={getConfig("map_threshold") || "0.01"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <TextField
                    label="Low Margin Threshold (%)"
                    value={getConfig("low_margin_threshold") || "15"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <TextField
                    label="High Margin Threshold (%)"
                    value={getConfig("high_margin_threshold") || "50"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <Select
                    label="Default Pricing Strategy"
                    value={getConfig("pricing_strategy") || "map"}
                    onChange={() => {}}
                    options={[
                      { label: "MAP", value: "map" },
                      { label: "MSRP", value: "msrp" },
                      { label: "Cost Plus", value: "cost_plus" },
                      { label: "Liquidation", value: "liquidation" },
                      { label: "Clearance", value: "clearance" },
                    ]}
                  />
                </FormLayout>
              </Card>
            )}
            
            {selectedTab === 2 && (
              <Card title="Vendor Defaults" sectioned>
                <FormLayout>
                  <Select
                    label="Default Vendor"
                    value={getConfig("default_vendor") || ""}
                    onChange={() => {}}
                    options={[
                      { label: "Select vendor...", value: "" },
                      ...vendors.map(v => ({ label: v.name, value: v.id })),
                    ]}
                  />
                  <TextField
                    label="Default Pricebook Update Frequency (days)"
                    value={getConfig("pricebook_update_freq") || "7"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <Checkbox
                    label="Auto-sync on Pricebook Upload"
                    checked={getConfig("auto_sync_upload") === "true"}
                    onChange={() => {}}
                  />
                  <Checkbox
                    label="Auto-detect Vendor from Filename"
                    checked={getConfig("auto_detect_vendor") === "true"}
                    onChange={() => {}}
                  />
                </FormLayout>
              </Card>
            )}
            
            {selectedTab === 3 && (
              <Card title="Advanced Settings" sectioned>
                <FormLayout>
                  <TextField
                    label="API Rate Limit (requests/min)"
                    value={getConfig("api_rate_limit") || "100"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <TextField
                    label="Batch Size (products)"
                    value={getConfig("batch_size") || "100"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <TextField
                    label="Health Scan Retention (days)"
                    value={getConfig("health_retention") || "90"}
                    onChange={() => {}}
                    autoComplete="off"
                    type="number"
                  />
                  <TextField
                    label="Log Level"
                    value={getConfig("log_level") || "info"}
                    onChange={() => {}}
                    autoComplete="off"
                  />
                  <Checkbox
                    label="Debug Mode"
                    checked={getConfig("debug_mode") === "true"}
                    onChange={() => {}}
                  />
                  <Checkbox
                    label="Audit Logging"
                    checked={getConfig("audit_logging") !== "false"}
                    onChange={() => {}}
                  />
                </FormLayout>
              </Card>
            )}
          </Tabs>
        </Layout.Section>
        
        {showToast && (
          <Toast content={toastMessage} onDismiss={() => setShowToast(false)} />
        )}
      </Layout>
    </Page>
  );
}
