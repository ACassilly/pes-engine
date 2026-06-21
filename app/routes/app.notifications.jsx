import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page, Layout, Card, DataTable, Text, Badge, InlineStack, Box,
  Banner, Button, Pagination, Tabs,
} from "@shopify/polaris";
import {
  BellIcon, CheckCircleIcon, ExclamationTriangleIcon,
  AlertCircleIcon, InfoCircleIcon, ArrowPathIcon,
} from "@shopify/polaris-icons";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "unread";
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 50;
  
  const where = tab === "unread" ? { isRead: false } : {};
  
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
  
  const totalUnread = await prisma.notification.count({ where: { isRead: false } });
  const totalAll = await prisma.notification.count();
  
  return json({ notifications, totalUnread, totalAll, page, perPage, tab });
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const notificationId = formData.get("notificationId");
  
  if (action === "mark_read") {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
    return { status: "marked_read" };
  }
  
  if (action === "mark_all_read") {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { status: "all_marked_read" };
  }
  
  if (action === "cleanup") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff }, isRead: true },
    });
    return { status: "cleaned_up" };
  }
  
  return { status: "unknown" };
};

export default function NotificationsPage() {
  const { notifications, totalUnread, totalAll, page, perPage, tab } = useLoaderData();
  const [selectedTab, setSelectedTab] = useState(tab);
  
  const tabs = [
    { id: "unread", content: `Unread (${totalUnread})`, accessibilityLabel: "Unread Notifications" },
    { id: "all", content: `All (${totalAll})`, accessibilityLabel: "All Notifications" },
  ];
  
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "error": return AlertCircleIcon;
      case "warning": return ExclamationTriangleIcon;
      case "success": return CheckCircleIcon;
      default: return InfoCircleIcon;
    }
  };
  
  const getSeverityTone = (severity) => {
    switch (severity) {
      case "error": return "critical";
      case "warning": return "warning";
      case "success": return "success";
      default: return "info";
    }
  };
  
  const notificationRows = notifications.map(n => [
    <Badge tone={getSeverityTone(n.severity)} icon={getSeverityIcon(n.severity)}>
      {n.severity}
    </Badge>,
    n.type,
    n.title,
    n.message.substring(0, 80),
    new Date(n.createdAt).toLocaleString(),
    <Badge tone={n.isRead ? "success" : "warning"}>
      {n.isRead ? "Read" : "Unread"}
    </Badge>,
  ]);
  
  return (
    <Page
      title="Notifications"
      subtitle="In-app alerts for EOL detections, price alerts, health issues, and system events"
      primaryAction={
        <Button
          variant="primary"
          icon={CheckCircleIcon}
          onClick={() => {
            const form = document.createElement("form");
            form.method = "post";
            const input = document.createElement("input");
            input.name = "action";
            input.value = "mark_all_read";
            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
          }}
        >
          Mark All Read
        </Button>
      }
      secondaryActions={[
        {
          content: "Cleanup Old",
          onAction: () => {
            const form = document.createElement("form");
            form.method = "post";
            const input = document.createElement("input");
            input.name = "action";
            input.value = "cleanup";
            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
          },
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Banner tone={totalUnread > 0 ? "warning" : "success"}>
            <p>
              {totalUnread > 0
                ? `You have ${totalUnread} unread notification${totalUnread > 1 ? "s" : ""}.`
                : "No unread notifications."}
            </p>
          </Banner>
        </Layout.Section>
        
        <Layout.Section>
          <Tabs
            tabs={tabs}
            selected={tabs.findIndex(t => t.id === selectedTab)}
            onSelect={(i) => {
              setSelectedTab(tabs[i].id);
              window.location.href = `?tab=${tabs[i].id}`;
            }}
          >
            <Card>
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Severity", "Type", "Title", "Message", "Date", "Status"]}
                rows={notificationRows}
                footerContent={
                  <Pagination
                    hasPrevious={page > 1}
                    hasNext={page * perPage < (selectedTab === "unread" ? totalUnread : totalAll)}
                    onPrevious={() => window.location.href = `?tab=${selectedTab}&page=${page - 1}`}
                    onNext={() => window.location.href = `?tab=${selectedTab}&page=${page + 1}`}
                  />
                }
              />
            </Card>
          </Tabs>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
