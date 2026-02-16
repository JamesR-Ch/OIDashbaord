function normalizeUrl(raw: string, fallback: string): string {
  const value = (raw || "").trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceRole: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  workerControlUrl: normalizeUrl(process.env.WORKER_CONTROL_URL || "", "http://127.0.0.1:4100"),
  workerControlSecret: process.env.WORKER_CONTROL_SECRET || "",
  webhookSecret: process.env.TRADINGVIEW_WEBHOOK_SECRET || "",
  webhookMaxSkewSeconds: Number(process.env.WEBHOOK_MAX_SKEW_SECONDS || "600"),
  webhookReplayTtlMinutes: Number(process.env.WEBHOOK_REPLAY_TTL_MINUTES || "120"),
  webhookRateLimitPerMinute: Number(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || "180"),
  webhookMaxBodyBytes: Number(process.env.WEBHOOK_MAX_BODY_BYTES || "16384"),
  webhookRequireSignature: (process.env.WEBHOOK_REQUIRE_SIGNATURE || "false") === "true",
  webhookAllowBodySecretFallback: (process.env.WEBHOOK_ALLOW_BODY_SECRET_FALLBACK || "true") === "true",
  runNowCooldownSeconds: Number(process.env.RUN_NOW_COOLDOWN_SECONDS || "20"),
  cmeLinkUpdateCooldownSeconds: Number(process.env.CME_LINK_UPDATE_COOLDOWN_SECONDS || "20"),
  authSessionRateLimitPerMinute: Number(process.env.AUTH_SESSION_RATE_LIMIT_PER_MINUTE || "30"),
  authLoginRateLimitPerMinute: Number(process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE || "15"),
  adminApiRateLimitPerMinute: Number(process.env.ADMIN_API_RATE_LIMIT_PER_MINUTE || "60"),
  authLoginMaxFailedAttempts: Number(process.env.AUTH_LOGIN_MAX_FAILED_ATTEMPTS || "5"),
  authLoginLockMinutes: Number(process.env.AUTH_LOGIN_LOCK_MINUTES || "15"),
  systemAlertWebhook4xxRatePct: Number(process.env.SYSTEM_ALERT_WEBHOOK_4XX_RATE_PCT || "20"),
  systemAlertWebhookMinSamples: Number(process.env.SYSTEM_ALERT_WEBHOOK_MIN_SAMPLES || "20"),
  systemAlertWebhook5xxCount: Number(process.env.SYSTEM_ALERT_WEBHOOK_5XX_COUNT || "1"),
  appName: process.env.NEXT_PUBLIC_APP_NAME || "OIDashboard"
};

export function requireEnv(name: string, value: string): string {
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}
