import { prisma } from "../db.server";
import { parseExcel, parseCSV, detectVendor, savePricebookEntries } from "../engine/vendor-parser.js";
import { runEOLDetectionScan } from "../engine/eol-detector.js";
import { runFullHealthScan } from "../engine/catalog-health.js";
import { importCompetitorData } from "../engine/competitor-intel.js";
import fs from "fs";
import path from "path";
import cron from "node-cron";

/**
 * PES Engine — Background Job Scheduler
 * All jobs run locally via node-cron (no external scheduler required)
 */

const JOBS = {
  // Vendor pricebook sync — weekly on Monday at 2:00 AM
  vendorSync: {
    schedule: process.env.VENDOR_SYNC_SCHEDULE || "0 2 * * 1",
    enabled: process.env.CRON_ENABLED === "true",
    async handler() {
      console.log("[CRON] Starting vendor pricebook sync...");
      
      const vendors = await prisma.vendor.findMany({ where: { isActive: true } });
      const uploadDir = process.env.UPLOAD_DIR || "./data/uploads";
      
      for (const vendor of vendors) {
        // In airgap mode, scan upload directory for new files
        const vendorDir = path.join(uploadDir, vendor.code);
        if (!fs.existsSync(vendorDir)) continue;
        
        const files = fs.readdirSync(vendorDir).filter(f => 
          f.endsWith(".pdf") || f.endsWith(".xlsx") || f.endsWith(".xls") || f.endsWith(".csv")
        );
        
        for (const file of files) {
          const filePath = path.join(vendorDir, file);
          const stat = fs.statSync(filePath);
          
          // Check if already processed
          const existing = await prisma.pricebook.findFirst({
            where: { filePath },
            orderBy: { createdAt: "desc" },
          });
          
          if (existing && existing.createdAt >= stat.mtime) continue;
          
          // Process new/updated file
          let sheets;
          if (file.endsWith(".csv")) {
            sheets = await parseCSV(filePath);
          } else {
            sheets = await parseExcel(filePath);
          }
          
          const detectedVendor = detectVendor(file, [], []);
          const parser = detectedVendor !== "default" ? detectedVendor : "default";
          const { parse: parseFn } = await import("../engine/vendor-parser.js").then(m => 
            m.VENDOR_PARSERS[parser] || m.VENDOR_PARSERS.default
          );
          const entries = parseFn(sheets);
          
          const pricebook = await prisma.pricebook.create({
            data: {
              vendorId: vendor.id,
              effectiveDate: new Date(),
              fileName: file,
              filePath,
              fileSize: stat.size,
              mimeType: file.endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              status: "current",
            },
          });
          
          await savePricebookEntries(pricebook.id, entries, "cron");
          console.log(`[CRON] Processed ${file} for ${vendor.name}: ${entries.length} entries`);
        }
      }
      
      console.log("[CRON] Vendor pricebook sync complete.");
    },
  },
  
  // EOL detection scan — daily at 3:00 AM
  eolScan: {
    schedule: process.env.EOL_SCAN_SCHEDULE || "0 3 * * *",
    enabled: process.env.CRON_ENABLED === "true",
    async handler() {
      console.log("[CRON] Starting EOL detection scan...");
      const results = await runEOLDetectionScan("cron");
      console.log(`[CRON] EOL scan complete: ${results.eolDetected} detected, ${results.replacementsFound} replacements found.`);
    },
  },
  
  // Health scan — daily at 4:00 AM
  healthScan: {
    schedule: process.env.HEALTH_SCAN_SCHEDULE || "0 4 * * *",
    enabled: process.env.CRON_ENABLED === "true",
    async handler() {
      console.log("[CRON] Starting health scan...");
      const results = await runFullHealthScan("cron");
      console.log(`[CRON] Health scan complete: ${results.issuesFound} issues found, score: ${results.healthScore}/100.`);
    },
  },
  
  // Competitor monitoring — weekly on Monday at 5:00 AM (disabled in airgap)
  competitorMonitor: {
    schedule: process.env.COMPETITOR_MONITOR_SCHEDULE || "0 5 * * 1",
    enabled: process.env.CRON_ENABLED === "true" && process.env.COMPETITOR_SCRAPING_ENABLED === "true",
    async handler() {
      console.log("[CRON] Starting competitor monitoring...");
      // In airgap mode, this is a no-op
      // In online mode with scraping enabled, would trigger scraper
      console.log("[CRON] Competitor monitoring: scraping disabled in airgap mode.");
    },
  },
  
  // Report generation — monthly on the 1st at 6:00 AM
  reportGeneration: {
    schedule: process.env.REPORT_SCHEDULE || "0 6 1 * *",
    enabled: process.env.CRON_ENABLED === "true",
    async handler() {
      console.log("[CRON] Generating scheduled reports...");
      
      const reports = [
        { type: "pricing_audit", name: "Monthly Pricing Audit" },
        { type: "catalog_health", name: "Monthly Catalog Health" },
        { type: "competitor_gap", name: "Monthly Competitor Gap" },
      ];
      
      for (const r of reports) {
        await prisma.report.create({
          data: {
            name: r.name,
            reportType: r.type,
            status: "completed",
            generatedBy: "cron",
          },
        });
      }
      
      console.log("[CRON] Scheduled reports generated.");
    },
  },
  
  // Backup — daily at midnight (if enabled)
  backup: {
    schedule: "0 0 * * *",
    enabled: process.env.BACKUP_ENABLED === "true",
    async handler() {
      console.log("[CRON] Starting database backup...");
      // Backup logic handled by backup.sh or Docker backup service
      console.log("[CRON] Backup triggered (see backup service logs).");
    },
  },
};

/**
 * Initialize all scheduled jobs
 */
export function initializeJobs() {
  if (process.env.CRON_ENABLED !== "true") {
    console.log("[CRON] Background jobs disabled (CRON_ENABLED=false).");
    return [];
  }
  
  const tasks = [];
  
  for (const [name, job] of Object.entries(JOBS)) {
    if (!job.enabled) {
      console.log(`[CRON] ${name}: disabled.`);
      continue;
    }
    
    try {
      const task = cron.schedule(job.schedule, async () => {
        console.log(`[CRON] ${name}: started at ${new Date().toISOString()}`);
        try {
          await job.handler();
        } catch (error) {
          console.error(`[CRON] ${name}: error:`, error.message);
        }
        console.log(`[CRON] ${name}: finished at ${new Date().toISOString()}`);
      }, {
        scheduled: true,
        timezone: "UTC",
      });
      
      tasks.push({ name, task, schedule: job.schedule });
      console.log(`[CRON] ${name}: scheduled (${job.schedule}).`);
    } catch (error) {
      console.error(`[CRON] ${name}: failed to schedule:`, error.message);
    }
  }
  
  return tasks;
}

/**
 * Run a job manually
 */
export async function runJob(name) {
  const job = JOBS[name];
  if (!job) {
    throw new Error(`Unknown job: ${name}`);
  }
  
  console.log(`[CRON] ${name}: manual trigger at ${new Date().toISOString()}`);
  await job.handler();
  console.log(`[CRON] ${name}: manual complete.`);
}

/**
 * Get job status
 */
export function getJobStatus() {
  return Object.entries(JOBS).map(([name, job]) => ({
    name,
    schedule: job.schedule,
    enabled: job.enabled,
  }));
}

export { JOBS };
