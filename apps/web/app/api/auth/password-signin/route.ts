import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DateTime } from "luxon";
import { config, requireEnv } from "../../../../lib/config";
import { getAdminDb } from "../../../../lib/db";
import { checkRateLimit } from "../../../../lib/rate-limit";

const payloadSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(512)
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);
  const rate = checkRateLimit(
    `password_signin:${clientIp}`,
    config.authSessionRateLimitPerMinute,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "too many login requests", retry_after_ms: rate.retryAfterMs },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const now = DateTime.utc();
  const adminDb = getAdminDb();

  const { data: lockRow } = await adminDb
    .from("auth_login_lockouts")
    .select("failed_attempts,locked_until")
    .eq("email", email)
    .maybeSingle();

  if (lockRow?.locked_until) {
    const lockedUntil = DateTime.fromISO(lockRow.locked_until, { zone: "utc" });
    if (lockedUntil.isValid && lockedUntil > now) {
      return NextResponse.json(
        {
          error: "account temporarily locked",
          locked_until_utc: lockedUntil.toISO()
        },
        { status: 429 }
      );
    }
  }

  const supabaseUrl = requireEnv("SUPABASE_URL", config.supabaseUrl);
  const publishableKey = requireEnv("SUPABASE_PUBLISHABLE_KEY", config.supabaseAnonKey);
  const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password: parsed.data.password
  });

  if (error || !data.session) {
    const failedAttempts = (lockRow?.failed_attempts || 0) + 1;
    const shouldLock = failedAttempts >= config.authLoginMaxFailedAttempts;
    const lockedUntil = shouldLock ? now.plus({ minutes: config.authLoginLockMinutes }).toISO() : null;

    await adminDb.from("auth_login_lockouts").upsert(
      {
        email,
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
        last_failed_at: now.toISO(),
        updated_at: now.toISO()
      },
      { onConflict: "email" }
    );

    const status = shouldLock ? 429 : 401;
    return NextResponse.json(
      {
        error: shouldLock ? "account temporarily locked" : "invalid email or password",
        locked_until_utc: lockedUntil
      },
      { status }
    );
  }

  await adminDb.from("auth_login_lockouts").delete().eq("email", email);

  return NextResponse.json({
    ok: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    }
  });
}
