/**
 * Airgap Configuration Loader — PES Engine
 * Loads and validates airgap configuration for offline/enterprise deployments
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const AIRGAP_CONFIG_PATH = process.env.AIRGAP_CONFIG_PATH || "./config/airgap.yml";

let cachedConfig = null;

export function loadAirgapConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(AIRGAP_CONFIG_PATH)) {
      const content = fs.readFileSync(AIRGAP_CONFIG_PATH, "utf-8");
      cachedConfig = yaml.load(content);
    } else {
      cachedConfig = {
        mode: process.env.AIRGAP_MODE === "true" ? "airgap" : "online",
        version: "1.0.0",
        external_apis: {
          competitor_scraping: { enabled: false, fallback: "manual_csv_import" },
          manufacturer_spec_fetch: { enabled: false, fallback: "local_file_upload" },
          email_service: { enabled: false, fallback: "local_notification_system" },
          analytics_telemetry: { enabled: false, fallback: "local_analytics" },
          llm_generation: { enabled: false, fallback: "template_engine" },
          cloud_storage: { enabled: false, fallback: "local_file_storage" },
          cdn_assets: { enabled: false, fallback: "local_bundled_assets" },
        },
        allowed_apis: {
          shopify_admin: { enabled: true, required: true },
          shopify_storefront: { enabled: true, required: false },
          shopify_graphql: { enabled: true, required: false },
        },
        local_features: {
          vendor_file_upload: { enabled: true },
          spec_file_upload: { enabled: true },
          competitor_csv_import: { enabled: true },
          manufacturer_contact_db: { enabled: true },
          all_engine_modules: { enabled: true },
          all_dashboard_modules: { enabled: true },
          theme_extensions: { enabled: true },
          scheduled_jobs: { enabled: true },
          reports: { enabled: true },
        },
        security: {
          telemetry_disabled: true,
          analytics_phoning_home: false,
          auto_updates: false,
          external_cdns: false,
          self_signed_certificates: true,
          audit_logging: true,
          data_encryption: false,
        },
      };
    }
    return cachedConfig;
  } catch (error) {
    console.error("[Airgap] Error loading config:", error.message);
    return { mode: "online", error: error.message };
  }
}

export function isFeatureAvailable(featureName) {
  const config = loadAirgapConfig();
  if (config.mode === "online") return true;
  if (config.local_features?.[featureName]) {
    return config.local_features[featureName].enabled !== false;
  }
  if (config.external_apis?.[featureName]) {
    return config.external_apis[featureName].enabled === true;
  }
  return true;
}

export function getFallbackMethod(featureName) {
  const config = loadAirgapConfig();
  if (config.external_apis?.[featureName]) {
    return config.external_apis[featureName].fallback || null;
  }
  return null;
}

export function isExternalApiEnabled(apiName) {
  const config = loadAirgapConfig();
  if (config.mode === "online") return true;
  if (config.external_apis?.[apiName]) {
    return config.external_apis[apiName].enabled === true;
  }
  return false;
}

export function getDeploymentMode() {
  return process.env.AIRGAP_MODE === "true" ? "airgap" : "online";
}

export function validateAirgapConfig() {
  const config = loadAirgapConfig();
  const issues = [];
  if (config.mode === "airgap") {
    for (const [api, settings] of Object.entries(config.external_apis || {})) {
      if (settings.enabled) {
        issues.push({
          severity: "warning",
          message: `External API '${api}' is enabled in airgap mode`,
          recommendation: `Disable ${api} or switch to online mode`,
        });
      }
    }
    const requiredFeatures = [
      "vendor_file_upload",
      "spec_file_upload",
      "all_engine_modules",
      "theme_extensions",
    ];
    for (const feature of requiredFeatures) {
      if (!config.local_features?.[feature]?.enabled) {
        issues.push({
          severity: "error",
          message: `Required feature '${feature}' is disabled in airgap mode`,
          recommendation: `Enable ${feature} in config/airgap.yml`,
        });
      }
    }
    if (!config.allowed_apis?.shopify_admin?.enabled) {
      issues.push({
        severity: "critical",
        message: "Shopify Admin API is disabled — required for all operations",
        recommendation: "Enable shopify_admin in allowed_apis",
      });
    }
  }
  return {
    valid: issues.filter(i => i.severity === "error" || i.severity === "critical").length === 0,
    issues,
  };
}

export function getAirgapStatus() {
  const config = loadAirgapConfig();
  const validation = validateAirgapConfig();
  return {
    mode: config.mode,
    version: config.version,
    external_apis: Object.entries(config.external_apis || {}).map(([name, settings]) => ({
      name,
      enabled: settings.enabled,
      fallback: settings.fallback,
    })),
    local_features: Object.entries(config.local_features || {}).map(([name, settings]) => ({
      name,
      enabled: settings.enabled,
    })),
    validation,
    timestamp: new Date().toISOString(),
  };
}
