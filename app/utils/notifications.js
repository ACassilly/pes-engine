import { prisma } from "../db.server";

/**
 * Notification Engine — PES Engine
 * Creates and manages in-app notifications for alerts, scan results, and system events
 */

const NOTIFICATION_TYPES = {
  PRICE_ALERT: "price_alert",
  EOL_DETECTED: "eol_detected",
  HEALTH_ISSUE: "health_issue",
  COMPETITOR_ALERT: "competitor_alert",
  VENDOR_SYNC: "vendor_sync",
  SYSTEM: "system",
  REPORT_READY: "report_ready",
};

const SEVERITY_LEVELS = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  SUCCESS: "success",
};

export async function createNotification({
  userId = null,
  type,
  severity = "info",
  title,
  message,
  details = null,
  actionUrl = null,
  actionLabel = null,
}) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      severity,
      title,
      message,
      details: details ? JSON.stringify(details) : null,
      actionUrl,
      actionLabel,
      isRead: false,
      deliveredVia: "in_app",
      deliveryStatus: "sent",
    },
  });
}

export async function notifyMapViolation(product, issue, userId = null) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.PRICE_ALERT,
    severity: SEVERITY_LEVELS.ERROR,
    title: `MAP Violation: ${product.sku}`,
    message: `Product ${product.sku} (${product.title || product.model}) is priced at $${product.shopifyPrice} which is below the MAP of $${product.mapPrice}.`,
    details: {
      sku: product.sku,
      currentPrice: product.shopifyPrice,
      mapPrice: product.mapPrice,
      violation: issue,
      recommendedAction: "Update price to at least MAP",
    },
    actionUrl: "/app/pricing",
    actionLabel: "View Pricing Issues",
  });
}

export async function notifyEOLDetected(product, replacement = null, userId = null) {
  const title = replacement
    ? `EOL Detected: ${product.sku} → ${replacement.sku}`
    : `EOL Detected: ${product.sku}`;
  const message = replacement
    ? `Product ${product.sku} has been detected as end-of-life. Replacement: ${replacement.sku} (${replacement.model || replacement.title}).`
    : `Product ${product.sku} has been detected as end-of-life. No replacement found.`;
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.EOL_DETECTED,
    severity: SEVERITY_LEVELS.WARNING,
    title,
    message,
    details: {
      sku: product.sku,
      model: product.model,
      eolStrategy: product.eolStrategy,
      replacementSku: replacement?.sku || null,
      replacementModel: replacement?.model || null,
      confidence: product.replacementConfidence,
    },
    actionUrl: "/app/eol",
    actionLabel: "View EOL Products",
  });
}

export async function notifyCriticalHealthIssue(issue, userId = null) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.HEALTH_ISSUE,
    severity: SEVERITY_LEVELS.ERROR,
    title: `Critical Health Issue: ${issue.issueType}`,
    message: `${issue.description} — ${issue.suggestedAction}`,
    details: {
      issueType: issue.issueType,
      severity: issue.severity,
      description: issue.description,
      suggestedAction: issue.suggestedAction,
      shopifyProductId: issue.shopifyProductId,
    },
    actionUrl: "/app/health",
    actionLabel: "View Health Issues",
  });
}

export async function notifyCompetitorPriceGap(comparison, userId = null) {
  const pctDiff = parseFloat(comparison.pctDiff);
  const isHigher = pctDiff > 0;
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.COMPETITOR_ALERT,
    severity: isHigher ? SEVERITY_LEVELS.WARNING : SEVERITY_LEVELS.INFO,
    title: `Competitor Price ${isHigher ? "Higher" : "Lower"}: ${comparison.pesProduct.sku}`,
    message: `PES price: $${comparison.pesPrice} vs ${comparison.competitor?.displayName}: $${comparison.competitorPrice} (${pctDiff > 0 ? "+" : ""}${pctDiff}%).`,
    details: {
      sku: comparison.pesProduct.sku,
      pesPrice: comparison.pesPrice,
      competitorPrice: comparison.competitorPrice,
      competitorName: comparison.competitor?.displayName,
      pctDiff,
      status: comparison.status,
    },
    actionUrl: "/app/competitors",
    actionLabel: "View Competitors",
  });
}

export async function notifyVendorSyncComplete(vendorName, results, userId = null) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.VENDOR_SYNC,
    severity: results.errors?.length > 0 ? SEVERITY_LEVELS.WARNING : SEVERITY_LEVELS.SUCCESS,
    title: `Vendor Sync Complete: ${vendorName}`,
    message: `Processed ${results.created} entries. ${results.errors?.length > 0 ? `${results.errors.length} errors.` : "No errors."}`,
    details: {
      vendorName,
      entriesCreated: results.created,
      errors: results.errors?.length || 0,
    },
    actionUrl: "/app/vendors",
    actionLabel: "View Vendors",
  });
}

export async function notifyReportReady(report, userId = null) {
  return createNotification({
    userId,
    type: NOTIFICATION_TYPES.REPORT_READY,
    severity: SEVERITY_LEVELS.SUCCESS,
    title: `Report Ready: ${report.name}`,
    message: `Your ${report.reportType} report has been generated and is ready for download.`,
    details: {
      reportId: report.id,
      reportType: report.reportType,
      reportName: report.name,
      status: report.status,
    },
    actionUrl: "/app/reports",
    actionLabel: "View Reports",
  });
}

export async function markNotificationRead(notificationId, userId) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function getUnreadCount(userId = null) {
  const where = userId ? { userId, isRead: false } : { isRead: false };
  return prisma.notification.count({ where });
}

export async function getRecentNotifications(userId = null, limit = 20) {
  const where = userId ? { userId } : {};
  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function cleanupOldNotifications(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      isRead: true,
    },
  });
}

export { NOTIFICATION_TYPES, SEVERITY_LEVELS };
