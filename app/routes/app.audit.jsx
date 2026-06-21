import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, DataTable, Text, Button, Badge, Banner,
  Tabs, Select, InlineStack, Box, Pagination, DatePicker,
} from "@shopify/polaris";
import {
  ClipboardCheckIcon, FilterIcon, ArrowPathIcon,
  UserIcon, CalendarIcon, ClockIcon,
} from "@shopify/polaris-icons";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 50;
  const actionType = url.searchParams.get("actionType") || null;
  const status = url.searchParams.get("status") || null;
  
  const where = {};
  if (actionType) where.action = actionType;
  if (status) where.status = status;
  
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
    include: { user: { select: { name: true, email: true } } },
  });
  
  const totalLogs = await prisma.auditLog.count({ where });
  
  const actionTypes = await prisma.auditLog.findMany({
    distinct: ["action"],
    select: { action: true },
  });
  
  return json({ logs, totalLogs, page, perPage, actionTypes: actionTypes.map(a => a.action) });
};

export default function AuditPage() {
  const { logs, totalLogs, page, perPage, actionTypes } = useLoaderData();
  
  const logRows = logs.map(log => [
    log.id.substring(0, 8),
    log.action,
    log.targetType,
    log.targetId?.substring(0, 12) || "—",
    <Badge tone={log.status === "success" ? "success" : log.status === "error" ? "critical" : "warning"}>
      {log.status}
    </Badge>,
    log.user?.name || "System",
    new Date(log.createdAt).toLocaleString(),
  ]);
  
  return (
    <Page
      title="Audit Log"
      subtitle="Full audit trail of all actions, changes, and system events"
      primaryAction={
        <Button icon={ArrowPathIcon} onClick={() => window.location.reload()}>
          Refresh
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>All actions are logged with user attribution, timestamp, and status. Filter by action type or status.</p>
          </Banner>
        </Layout.Section>
        
        <Layout.Section>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p">{totalLogs} total audit entries</Text>
            <Select
              label="Filter by Action"
              labelHidden
              options={[
                { label: "All Actions", value: "" },
                ...actionTypes.map(t => ({ label: t, value: t })),
              ]}
              onChange={() => {}}
              value=""
            />
          </InlineStack>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text", "text", "text"]}
              headings={["ID", "Action", "Target Type", "Target ID", "Status", "User", "Timestamp"]}
              rows={logRows}
              footerContent={
                <Pagination
                  hasPrevious={page > 1}
                  hasNext={page * perPage < totalLogs}
                  onPrevious={() => window.location.href = `?page=${page - 1}`}
                  onNext={() => window.location.href = `?page=${page + 1}`}
                />
              }
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
