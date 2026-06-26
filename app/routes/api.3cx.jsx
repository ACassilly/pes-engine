import { json } from "@remix-run/node";
import { prisma } from "../db.server";

/**
 * 3CX Webhook Receiver — PES Engine
 * Receives call events from 3CX and forwards them to Odoo CRM
 *
 * 3CX Configuration:
 *   POST URL: https://your-pes-engine-url/api/3cx/webhook
 *   Content-Type: application/json
 *   Body: { callerNumber, calleeNumber, duration, callType, timestamp, recordingUrl }
 */

export async function action({ request }) {
  const authHeader = request.headers.get("Authorization") || "";
  const expectedSecret = process.env.THREE_CX_WEBHOOK_SECRET;

  if (expectedSecret && !authHeader.includes(expectedSecret)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const {
      callerNumber,
      calleeNumber,
      duration,
      callType = "inbound",
      timestamp = new Date().toISOString(),
      recordingUrl,
    } = payload;

    console.log(`[3CX] ${callType} call from ${callerNumber} to ${calleeNumber}, duration: ${duration}s`);

    // Store in local database for audit trail
    await prisma.auditLog.create({
      data: {
        userId: "3cx-webhook",
        action: "3cx_call_received",
        entityType: "3cx_call",
        entityId: callerNumber,
        newValue: JSON.stringify({
          callerNumber,
          calleeNumber,
          duration,
          callType,
          timestamp,
          recordingUrl,
        }),
      },
    });

    // PARALLEL RUN MODE: Write to BOTH systems
    // Old Odoo 18 = PRIMARY (never fail this)
    // Riven ERP = SHADOW (log errors but don't block)
    
    let odooResult = null;
    let rivenResult = null;
    
    // 1. Write to Old Odoo 18 (PRIMARY)
    if (process.env.ODOO_SYNC_ENABLED === "true" && process.env.ODOO_USER && process.env.ODOO_PASSWORD) {
      try {
        const { log3CXCall } = await import("../.server/engine/odoo-connector.js");
        odooResult = await log3CXCall({
          callerNumber,
          calleeNumber,
          duration: parseFloat(duration) || 0,
          callType,
          timestamp: new Date(timestamp),
          recordingUrl,
        });
        console.log(`[3CX] Call logged to Old Odoo 18 (PRIMARY): ${callerNumber}`);
      } catch (odooErr) {
        console.error(`[3CX] FAILED to log to Old Odoo 18: ${odooErr.message}`);
        // In parallel run, Old Odoo 18 failures are critical
      }
    }
    
    // 2. Write to Riven ERP (SHADOW)
    const rivenConfigured = !!(
      process.env.RIVEN_ERP_URL &&
      process.env.RIVEN_ERP_PASSWORD
    );
    
    if (rivenConfigured) {
      try {
        const { log3CXCallToRiven } = await import("../.server/engine/riven-erp-connector.js");
        rivenResult = await log3CXCallToRiven({
          callerNumber,
          calleeNumber,
          duration: parseFloat(duration) || 0,
          callType,
          timestamp: new Date(timestamp),
          recordingUrl,
        });
        console.log(`[3CX] Call logged to Riven ERP (SHADOW): ${callerNumber}`);
      } catch (rivenErr) {
        console.error(`[3CX] Shadow write to Riven ERP failed: ${rivenErr.message}`);
        // Shadow failures are logged but don't block the primary
      }
    }

    return json({ 
      success: true, 
      parallelRun: true,
      primary: odooResult ? "ok" : "not_configured",
      shadow: rivenResult ? "ok" : rivenConfigured ? "failed" : "not_configured",
    });
  } catch (error) {
    console.error("[3CX Webhook Error]", error.message);
    return json({ error: error.message }, { status: 500 });
  }
}

// GET — health check for 3CX integration status
export async function loader({ request }) {
  const rivenConfigured = !!(
    process.env.RIVEN_ERP_URL &&
    process.env.RIVEN_ERP_PASSWORD
  );
  const odooConfigured = !!(
    process.env.ODOO_URL &&
    process.env.ODOO_DATABASE &&
    process.env.ODOO_USER &&
    process.env.ODOO_PASSWORD
  );

  return json({
    status: "ok",
    rivenConfigured,
    rivenErpUrl: process.env.RIVEN_ERP_URL || null,
    odooConfigured,
    odooUrl: process.env.ODOO_URL || null,
    odooDatabase: process.env.ODOO_DATABASE || null,
    threeCxUrl: process.env.THREE_CX_URL || null,
    timestamp: new Date().toISOString(),
  });
}

export default function ThreeCXWebhookRoute() {
  return null;
}
