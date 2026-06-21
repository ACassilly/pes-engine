import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting PES Engine database seed...");

  // ─── Vendors ──────────────────────────────
  const vendors = [
    { code: "generac", name: "Generac Power Systems", displayName: "Generac", contactName: "Jennifer Weiss / Spencer Warmuth", portalUrl: "https://www.generac.com/whs-gold" },
    { code: "cummins", name: "Cummins Inc.", displayName: "Cummins", contactName: "Jaime Gilmore", portalUrl: "https://www.cummins.com/dealer-portal" },
    { code: "eg4", name: "EG4 Electronics", displayName: "EG4", contactName: "Anthony Dawood", portalUrl: "https://www.eg4electronics.com/dealer" },
    { code: "enphase", name: "Enphase Energy", displayName: "Enphase", contactName: "", portalUrl: "https://www.enphase.com/partner-portal" },
    { code: "solaredge", name: "SolarEdge Technologies", displayName: "SolarEdge", contactName: "", portalUrl: "https://www.solaredge.com/monitoring" },
    { code: "sma", name: "SMA Solar Technology", displayName: "SMA", contactName: "", portalUrl: "https://www.sma-america.com" },
    { code: "fronius", name: "Fronius International", displayName: "Fronius", contactName: "", portalUrl: "https://www.fronius.com" },
    { code: "sol-ark", name: "Sol-Ark", displayName: "Sol-Ark", contactName: "", portalUrl: "https://www.sol-ark.com" },
    { code: "victron", name: "Victron Energy", displayName: "Victron", contactName: "", portalUrl: "https://www.victronenergy.com" },
    { code: "jinko", name: "Jinko Solar", displayName: "Jinko", contactName: "", portalUrl: "https://www.jinkosolar.com" },
    { code: "trina", name: "Trina Solar", displayName: "Trina", contactName: "", portalUrl: "https://www.trinasolar.com" },
    { code: "canadian-solar", name: "Canadian Solar", displayName: "Canadian Solar", contactName: "", portalUrl: "https://www.canadiansolar.com" },
    { code: "rec", name: "REC Group", displayName: "REC", contactName: "", portalUrl: "https://www.rec-group.com" },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { code: v.code },
      update: {},
      create: v,
    });
    console.log(`✅ Vendor: ${v.name}`);
  }

  // ─── Roles ────────────────────────────────
  const roles = [
    { name: "admin", displayName: "Administrator", permissions: JSON.stringify(["*"]), isSystem: true },
    { name: "pricing_manager", displayName: "Pricing Manager", permissions: JSON.stringify(["pricing:read", "pricing:write", "catalog:read", "reports:read"]), isSystem: true },
    { name: "content_manager", displayName: "Content Manager", permissions: JSON.stringify(["catalog:read", "catalog:write", "eol:read", "eol:write", "specs:read", "specs:write"]), isSystem: true },
    { name: "viewer", displayName: "Viewer", permissions: JSON.stringify(["catalog:read", "pricing:read", "reports:read"]), isSystem: true },
    { name: "vendor_manager", displayName: "Vendor Manager", permissions: JSON.stringify(["vendors:read", "vendors:write", "catalog:read"]), isSystem: true },
    { name: "health_manager", displayName: "Health Manager", permissions: JSON.stringify(["health:read", "health:write", "catalog:read"]), isSystem: true },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
    console.log(`✅ Role: ${r.displayName}`);
  }

  // ─── App Config ───────────────────────────
  const configs = [
    { key: "airgap_mode", value: "true", category: "airgap", dataType: "boolean", description: "Disable external APIs" },
    { key: "default_pricing_strategy", value: "map", category: "pricing", dataType: "string", description: "Default pricing strategy" },
    { key: "map_violation_threshold", value: "0.01", category: "pricing", dataType: "number", description: "MAP violation alert threshold" },
    { key: "eol_auto_detect", value: "true", category: "eol", dataType: "boolean", description: "Auto-detect EOL products" },
    { key: "cron_enabled", value: "true", category: "cron", dataType: "boolean", description: "Enable background jobs" },
    { key: "vendor_sync_schedule", value: "0 2 * * 1", category: "cron", dataType: "string", description: "Weekly vendor sync" },
    { key: "eol_scan_schedule", value: "0 3 * * *", category: "cron", dataType: "string", description: "Daily EOL scan" },
    { key: "health_scan_schedule", value: "0 4 * * *", category: "cron", dataType: "string", description: "Daily health scan" },
    { key: "competitor_monitor_schedule", value: "0 5 * * 1", category: "cron", dataType: "string", description: "Weekly competitor monitoring" },
    { key: "report_schedule", value: "0 6 1 * *", category: "cron", dataType: "string", description: "Monthly report generation" },
  ];

  for (const c of configs) {
    await prisma.appConfig.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    });
    console.log(`✅ Config: ${c.key}`);
  }

  // ─── Theme Extensions ─────────────────────
  const extensions = [
    { name: "eol-banner", displayName: "EOL Banner", description: "Displays end-of-life banners on product pages", version: "1.0.0", extensionType: "block", blockType: "@shopify/block" },
    { name: "comparison-table", displayName: "Comparison Table", description: "Side-by-side comparison of old vs new products", version: "1.0.0", extensionType: "block", blockType: "@shopify/block" },
    { name: "urgency-badges", displayName: "Urgency Badges", description: "Inventory and price urgency badges on collection cards", version: "1.0.0", extensionType: "block", blockType: "@shopify/block" },
    { name: "spec-sheet-button", displayName: "Spec Sheet Button", description: "Download spec sheet button on product pages", version: "1.0.0", extensionType: "block", blockType: "@shopify/block" },
    { name: "cross-sell-carousel", displayName: "Cross-Sell Carousel", description: "Recommended replacement products carousel", version: "1.0.0", extensionType: "block", blockType: "@shopify/block" },
  ];

  for (const ext of extensions) {
    await prisma.themeExtension.upsert({
      where: { name: ext.name },
      update: {},
      create: ext,
    });
    console.log(`✅ Extension: ${ext.displayName}`);
  }

  // ─── Competitors ──────────────────────────
  const competitors = [
    { name: "a1solarstore", displayName: "A1 Solar Store", url: "https://www.a1solarstore.com" },
    { name: "ussolarsupplier", displayName: "US Solar Supplier", url: "https://www.ussolarsupplier.com" },
    { name: "altestore", displayName: "altE Store", url: "https://www.altestore.com" },
    { name: "wholesalesolar", displayName: "Wholesale Solar", url: "https://www.wholesalesolar.com" },
    { name: "signaturesolar", displayName: "Signature Solar", url: "https://www.signaturesolar.com" },
  ];

  for (const c of competitors) {
    await prisma.competitor.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    console.log(`✅ Competitor: ${c.displayName}`);
  }

  // ─── EOL Mappings (Seed Generac, EG4, Enphase examples) ──
  const eolMappings = [
    { oldModel: "5871-0", oldTitle: "Generac 7kW Single Phase (Pre-2013)", newModel: "6437-0", newTitle: "Generac 7kW Single Phase (Post-2013)", upgradeBenefit: "Evolution Controller, quieter operation, better diagnostics", eolStrategy: "discontinued_reference", customerMessage: "This pre-2013 model has been superseded by the newer Evolution Controller model. The replacement offers improved diagnostics, quieter operation, and better reliability.", confidence: "high", category: "generators", vendor: "generac" },
    { oldModel: "5875-1", oldTitle: "Generac 7kW Three Phase (Pre-2013)", newModel: "6462-1", newTitle: "Generac 7kW Three Phase (Post-2013)", upgradeBenefit: "Evolution Controller, better diagnostics, three-phase support", eolStrategy: "discontinued_reference", customerMessage: "This pre-2013 three-phase model has been superseded by the newer Evolution Controller model.", confidence: "high", category: "generators", vendor: "generac" },
    { oldModel: "LifePower4 V1", oldTitle: "EG4 LifePower4 V1 100Ah", newModel: "LifePower4 V2", newTitle: "EG4 LifePower4 V2 100Ah", upgradeBenefit: "Improved BMS, better thermal management, enhanced cycle life", eolStrategy: "discontinued_reference", customerMessage: "The V1 battery has been superseded by the V2 with improved BMS and thermal management. V2 offers enhanced cycle life and safety features.", confidence: "high", category: "batteries", vendor: "eg4" },
    { oldModel: "IQ7", oldTitle: "Enphase IQ7 Microinverter", newModel: "IQ8", newTitle: "Enphase IQ8 Microinverter", upgradeBenefit: "Sunlight backup, grid-forming capability, higher efficiency", eolStrategy: "discontinued_reference", customerMessage: "IQ7 has been superseded by IQ8 with grid-forming capability and sunlight backup support. IQ8 offers higher efficiency and better grid resilience.", confidence: "high", category: "inverters", vendor: "enphase" },
    { oldModel: "M215", oldTitle: "Enphase M215 Microinverter", newModel: "M250", newTitle: "Enphase M250 Microinverter", upgradeBenefit: "Higher power output, better efficiency, longer warranty", eolStrategy: "discontinued_reference", customerMessage: "The M215 has been superseded by the M250 with higher power output and improved efficiency.", confidence: "high", category: "inverters", vendor: "enphase" },
  ];

  for (const m of eolMappings) {
    await prisma.eolMapping.upsert({
      where: { oldModel: m.oldModel },
      update: {},
      create: { ...m, isAutoGenerated: true },
    });
    console.log(`✅ EOL Mapping: ${m.oldModel} → ${m.newModel}`);
  }

  console.log("\n=========================================");
  console.log("✅ Database seed complete!");
  console.log("=========================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
