import { config as dotenvConfig } from "dotenv";
import path from "node:path";
import type { SymbolCode } from "@oid/shared";

// Monorepo-safe env loading: allow root .env when running from apps/worker workspace.
dotenvConfig({ path: path.resolve(process.cwd(), "../../.env") });
dotenvConfig();

type SymbolSessionMode = "auto" | "always_open" | "always_closed" | "fx_24_5" | "ifc_metal";
const SYMBOL_SESSION_MODES: Record<SymbolCode, SymbolSessionMode> = {
  XAUUSD: "auto",
  THBUSD: "auto",
  BTCUSD: "auto"
};

function parseSessionMode(value: string | undefined, fallback: SymbolSessionMode): SymbolSessionMode {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "auto" ||
    normalized === "always_open" ||
    normalized === "always_closed" ||
    normalized === "fx_24_5" ||
    normalized === "ifc_metal"
  ) {
    return normalized;
  }
  return fallback;
}

for (const symbol of Object.keys(SYMBOL_SESSION_MODES) as SymbolCode[]) {
  const key = `SYMBOL_SESSION_MODE_${symbol}` as const;
  SYMBOL_SESSION_MODES[symbol] = parseSessionMode(process.env[key], SYMBOL_SESSION_MODES[symbol]);
}

export const workerConfig = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRole: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  controlPort: Number(process.env.PORT || process.env.WORKER_CONTROL_PORT || "4100"),
  controlSecret: process.env.WORKER_CONTROL_SECRET || "",
  cmeSessionTimezone: process.env.CME_SESSION_TIMEZONE || "America/Chicago",
  cmeHolidayClosures: (process.env.CME_HOLIDAY_CLOSURES || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  cmeSessionForceOpen: (process.env.CME_SESSION_FORCE_OPEN || "false") === "true",
  webhookLogRetentionDays: Number(process.env.WEBHOOK_LOG_RETENTION_DAYS || "7"),
  relationCron: process.env.WORKER_CRON_RELATION || "*/30 * * * *",
  cmeCron: process.env.WORKER_CRON_CME || "*/30 * * * *",
  retentionCron: process.env.WORKER_RETENTION_CRON || "15 6 * * *",
  cmeTimeoutMs: Number(process.env.CME_TIMEOUT_MS || "45000"),
  cmeHeadless: (process.env.CME_HEADLESS || "true") === "true",
  cmeRequirePositiveDte: (process.env.CME_REQUIRE_POSITIVE_DTE || "true") === "true",
  cmeExtractMaxAttempts: Number(process.env.CME_EXTRACT_MAX_ATTEMPTS || "3"),
  cmeExtractRetryDelayMs: Number(process.env.CME_EXTRACT_RETRY_DELAY_MS || "1200"),
  relationStaleMinutes: Number(process.env.RELATION_STALE_MINUTES || "35"),
  cmeStaleMinutes: Number(process.env.CME_STALE_MINUTES || "35"),
  jobRunsRetentionDays: Number(process.env.JOB_RUNS_RETENTION_DAYS || "30"),
  authLockoutsRetentionDays: Number(process.env.AUTH_LOCKOUTS_RETENTION_DAYS || "30"),
  cmeSeriesLinksRetentionDays: Number(process.env.CME_SERIES_LINKS_RETENTION_DAYS || "90"),
  symbolSessionModes: SYMBOL_SESSION_MODES
};
