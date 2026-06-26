/**
 * Riven ERP Connector for PES Engine
 * Handles 3CX call logging and CRM sync to Riven ERP (Odoo 19)
 */

const RIVEN_ERP_URL = process.env.RIVEN_ERP_URL || "http://20.65.176.175:8069";
const RIVEN_ERP_USER = process.env.RIVEN_ERP_USER || "alex.cassilly@cassilly.capital";
const RIVEN_ERP_PASSWORD = process.env.RIVEN_ERP_PASSWORD;
const RIVEN_ERP_DB = process.env.RIVEN_ERP_DATABASE || "pes_crm";

/**
 * Log a 3CX call to Riven ERP CRM
 * Creates a crm.lead record (crm.phonecall removed in Odoo 19)
 */
export async function log3CXCallToRiven({
  callerNumber,
  calleeNumber,
  duration,
  callType,
  timestamp,
  recordingUrl,
}) {
  if (!RIVEN_ERP_PASSWORD) {
    throw new Error("RIVEN_ERP_PASSWORD not configured");
  }

  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        RIVEN_ERP_DB,
        2, // SUPERUSER_ID
        RIVEN_ERP_PASSWORD,
        "crm.lead",
        "create",
        [
          {
            name: `3CX ${callType} call from ${callerNumber}`,
            type: "lead",
            phone: callerNumber,
            description: `Call Type: ${callType}\nFrom: ${callerNumber}\nTo: ${calleeNumber}\nDuration: ${duration}s\nRecording: ${recordingUrl || "N/A"}\nTimestamp: ${timestamp.toISOString()}`,
            priority: "1",
            contact_name: `Caller ${callerNumber}`,
          },
        ],
      ],
    },
    id: Date.now(),
  };

  const response = await fetch(`${RIVEN_ERP_URL}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Riven ERP HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Riven ERP error: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

/**
 * Find a partner by phone number in Riven ERP
 */
export async function findPartnerByPhone(phoneNumber) {
  if (!RIVEN_ERP_PASSWORD) {
    throw new Error("RIVEN_ERP_PASSWORD not configured");
  }

  const normalized = phoneNumber.replace(/\D/g, "");

  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        RIVEN_ERP_DB,
        2,
        RIVEN_ERP_PASSWORD,
        "res.partner",
        "search_read",
        [
          [["phone", "ilike", normalized]],
          ["id", "name", "phone", "mobile"],
        ],
      ],
    },
    id: Date.now(),
  };

  const response = await fetch(`${RIVEN_ERP_URL}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Riven ERP HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Riven ERP error: ${JSON.stringify(data.error)}`);
  }

  return data.result || [];
}
