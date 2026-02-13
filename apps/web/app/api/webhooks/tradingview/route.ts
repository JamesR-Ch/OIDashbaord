import { tradingViewPayloadSchema } from "@oid/shared";
import { NextRequest, NextResponse } from "next/server";
import { config } from "../../../../lib/config";
import { getAdminDb } from "../../../../lib/db";
import { verifyHmacSha256 } from "../../../../lib/signature";
import { DateTime } from "luxon";
import crypto from "node:crypto";

function normalizeSymbol(input: string): "XAUUSD" | "THBUSD" | "BTCUSD" | null {
  const upper = input.toUpperCase().trim();
  const noExchange = upper.includes(":") ? upper.split(":").pop() || upper : upper;
  const compact = noExchange.replace(/[\/\-\s_]/g, "");

  if (compact === "XAUUSD") return "XAUUSD";
  if (compact === "THBUSD" || compact === "USDTHB") return "THBUSD";
  if (compact === "BTCUSD") return "BTCUSD";
  return null;
}

function parseTimestampToUtc(raw: string): DateTime | null {
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    const asSeconds = raw.length <= 10 ? numeric : numeric / 1000;
    const dt = DateTime.fromSeconds(asSeconds, { zone: "utc" });
    return dt.isValid ? dt : null;
  }

  const dt = DateTime.fromISO(raw, { zone: "utc" });
  return dt.isValid ? dt : null;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

async function logWebhookRequest(
  adminDb: ReturnType<typeof getAdminDb>,
  entry: { ip: string; status_code: number; note?: string }
) {
  const { error } = await adminDb.from("webhook_request_log").insert({
    source: "tradingview",
    ip: entry.ip,
    status_code: entry.status_code,
    note: entry.note || null
  });
  if (!error) return;
  const missingLogTable =
    error.message.includes("Could not find the table 'public.webhook_request_log'") ||
    error.code === "PGRST205";
  if (missingLogTable) return;
}

export async function POST(req: NextRequest) {
  if (!config.webhookSecret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const clientIp = getClientIp(req);
  const rawBody = await req.text();
  if (rawBody.length > config.webhookMaxBodyBytes) {
    await logWebhookRequest(getAdminDb(), { ip: clientIp, status_code: 413, note: "payload_too_large" });
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  const signature = req.headers.get("x-tv-signature");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    await logWebhookRequest(getAdminDb(), { ip: clientIp, status_code: 400, note: "invalid_json_payload" });
    return NextResponse.json({ error: "invalid json payload" }, { status: 400 });
  }
  const parsed = tradingViewPayloadSchema.safeParse(parsedJson);

  if (!parsed.success) {
    await logWebhookRequest(getAdminDb(), { ip: clientIp, status_code: 400, note: "schema_validation_failed" });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const symbolRaw = "symbol" in payload ? payload.symbol : undefined;
  const tickerRaw = "ticker" in payload ? (payload as any).ticker : undefined;
  const normalizedSymbol = normalizeSymbol(symbolRaw || tickerRaw || "");
  if (!normalizedSymbol) {
    const unsupported = symbolRaw || tickerRaw || "unknown";
    await logWebhookRequest(getAdminDb(), { ip: clientIp, status_code: 400, note: `unsupported_symbol_${unsupported}` });
    return NextResponse.json({ error: `unsupported symbol: ${unsupported}` }, { status: 400 });
  }

  const signatureValid = signature ? verifyHmacSha256(config.webhookSecret, rawBody, signature) : false;
  const bodySecret = "secret" in payload ? payload.secret : undefined;
  const bodySecretValid = bodySecret === config.webhookSecret;

  const authValid = config.webhookRequireSignature
    ? signatureValid
    : signatureValid || (config.webhookAllowBodySecretFallback && bodySecretValid);

  if (!authValid) {
    await logWebhookRequest(getAdminDb(), { ip: clientIp, status_code: 401, note: "invalid webhook auth" });
    return NextResponse.json({ error: "invalid webhook authentication" }, { status: 401 });
  }

  const adminDb = getAdminDb();
  const oneMinuteAgoIso = DateTime.utc().minus({ minutes: 1 }).toISO();
  const { count: requestCount, error: limitError } = await adminDb
    .from("webhook_request_log")
    .select("ip", { count: "exact", head: true })
    .eq("source", "tradingview")
    .eq("ip", clientIp)
    .gte("received_at", oneMinuteAgoIso);

  if (limitError) {
    const missingLogTable =
      limitError.message.includes("Could not find the table 'public.webhook_request_log'") ||
      limitError.code === "PGRST205";
    if (!missingLogTable) {
      return NextResponse.json({ error: `webhook rate limiter failure: ${limitError.message}` }, { status: 500 });
    }
  } else if ((requestCount || 0) >= config.webhookRateLimitPerMinute) {
    await logWebhookRequest(adminDb, {
      ip: clientIp,
      status_code: 429,
      note: `rate_limit_exceeded_${config.webhookRateLimitPerMinute}_per_minute`
    });
    return NextResponse.json({ error: "rate limit exceeded" }, { status: 429 });
  }

  const nowUtc = DateTime.utc();
  const utc =
    "event_time_utc" in payload
      ? DateTime.fromISO(payload.event_time_utc, { zone: "utc" })
      : parseTimestampToUtc((payload as any).timestamp || (payload as any).time || "");

  if (!utc || !utc.isValid) {
    await logWebhookRequest(adminDb, { ip: clientIp, status_code: 400, note: "invalid timestamp" });
    return NextResponse.json({ error: "invalid timestamp/event_time_utc" }, { status: 400 });
  }

  const ageSeconds = Math.abs(nowUtc.diff(utc, "seconds").seconds);
  if (ageSeconds > config.webhookMaxSkewSeconds) {
    await logWebhookRequest(adminDb, { ip: clientIp, status_code: 400, note: "timestamp_skew_exceeded" });
    return NextResponse.json(
      {
        error: `payload timestamp outside allowed skew (${config.webhookMaxSkewSeconds}s)`
      },
      { status: 400 }
    );
  }

  const minuteBucketUtc = utc.startOf("minute");
  const replayFingerprint = crypto
    .createHash("sha256")
    .update(rawBody)
    .digest("hex");

  const replayExpiresAt = nowUtc.plus({ minutes: config.webhookReplayTtlMinutes }).toISO();
  const { error: replayError } = await adminDb.from("webhook_replay_guard").insert({
    fingerprint: replayFingerprint,
    source: "tradingview",
    expires_at: replayExpiresAt
  });

  if (replayError) {
    const missingReplayTable =
      replayError.message.includes("Could not find the table 'public.webhook_replay_guard'") ||
      replayError.code === "PGRST205";

    if (missingReplayTable) {
      // Backward compatibility: allow ingest before migration 004 is applied.
    } else if (replayError.code === "23505") {
      await logWebhookRequest(adminDb, { ip: clientIp, status_code: 409, note: "replay_detected" });
      return NextResponse.json({ error: "replayed webhook payload" }, { status: 409 });
    } else {
      await logWebhookRequest(adminDb, { ip: clientIp, status_code: 500, note: "replay_guard_failure" });
      return NextResponse.json({ error: `replay guard failure: ${replayError.message}` }, { status: 500 });
    }
  }

  const { error } = await adminDb.from("price_ticks").upsert(
    {
      symbol: normalizedSymbol,
      price: payload.price,
      event_time_utc: minuteBucketUtc.toISO(),
      event_time_bkk: minuteBucketUtc.setZone("Asia/Bangkok").toISO()
    },
    {
      onConflict: "symbol,event_time_utc",
      ignoreDuplicates: false
    }
  );

  if (error) {
    await logWebhookRequest(adminDb, { ip: clientIp, status_code: 500, note: "price_tick_upsert_failure" });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logWebhookRequest(adminDb, { ip: clientIp, status_code: 200, note: "ok" });
  return NextResponse.json({ ok: true });
}
