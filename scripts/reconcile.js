#!/usr/bin/env node
/**
 * PES → Riven ERP Migration Reconciliation Script
 * Compares record counts between Old Odoo 18 and Riven ERP
 * 
 * Usage: node scripts/reconcile.js
 */

const OLD_ODOO_URL = "https://erp.portlandiaelectric.supply";
const OLD_ODOO_DB = "OddoERP";
const OLD_ODOO_USER = "byzid.bostame@portlandiaelectric.supply";
const OLD_ODOO_PASSWORD = "Cosmed502@";

const RIVEN_ERP_URL = "http://20.65.176.175:8069";
const RIVEN_ERP_DB = "pes_crm";
const RIVEN_ERP_USER = "alex.cassilly@cassilly.capital";
const RIVEN_ERP_PASSWORD = "PESMigration2025!";

async function odooJsonRpc(url, db, uid, password, model, method, args = [], kwargs = {}) {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [db, uid, password, model, method, args, kwargs],
    },
    id: Date.now(),
  };
  const response = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`Odoo Error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function authenticate(url, db, username, password) {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [db, username, password, {}],
    },
    id: Date.now(),
  };
  const response = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (data.error) throw new Error(`Auth Error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function getCounts(url, db, uid, password, label) {
  console.log(`\n📊 ${label} — Counting records...`);
  const counts = {};
  const models = [
    ("res.partner", "Customers", [["customer_rank", ">", 0]]),
    ("hr.employee", "Employees", []),
    ("sale.order", "Orders", []),
    ("crm.lead", "Leads", []),
    ("account.account", "Accounts", []),
    ("product.product", "Products", []),
    ("res.partner", "Contacts", []),
  ];
  for (const [model, name, domain] of models) {
    try {
      counts[name] = await odooJsonRpc(url, db, uid, password, model, "search_count", [domain]);
      console.log(`  ✅ ${name}: ${counts[name]}`);
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      counts[name] = null;
    }
  }
  return counts;
}

async function reconcile() {
  console.log("🔍 PES → Riven ERP Migration Reconciliation");
  const oldUid = await authenticate(OLD_ODOO_URL, OLD_ODOO_DB, OLD_ODOO_USER, OLD_ODOO_PASSWORD);
  const rivenUid = await authenticate(RIVEN_ERP_URL, RIVEN_ERP_DB, RIVEN_ERP_USER, RIVEN_ERP_PASSWORD);
  const oldCounts = await getCounts(OLD_ODOO_URL, OLD_ODOO_DB, oldUid, OLD_ODOO_PASSWORD, "Old Odoo 18");
  const rivenCounts = await getCounts(RIVEN_ERP_URL, RIVEN_ERP_DB, rivenUid, RIVEN_ERP_PASSWORD, "Riven ERP");

  console.log("\n📋 RECONCILIATION REPORT");
  const models = ["Customers", "Employees", "Orders", "Leads", "Accounts", "Products", "Contacts"];
  for (const model of models) {
    const oldVal = oldCounts[model] || 0;
    const rivenVal = rivenCounts[model] || 0;
    const diff = rivenVal - oldVal;
    const pct = oldVal > 0 ? ((rivenVal / oldVal) * 100).toFixed(1) : "N/A";
    const status = diff === 0 ? "✅ MATCH" : diff < 0 ? `⚠️  MISSING ${Math.abs(diff)}` : `📈 EXTRA ${diff}`;
    console.log(`${model.padEnd(12)} | Old: ${String(oldVal).padStart(6)} | Riven: ${String(rivenVal).padStart(6)} | ${pct}% | ${status}`);
  }
}

reconcile().catch(e => {
  console.error("\n💥 Fatal error:", e.message);
  process.exit(1);
});
