import { cmeLinkUpdateSchema } from "@oid/shared";
import { NextRequest, NextResponse } from "next/server";
import { assertAdmin, AuthError } from "../../../../lib/auth";
import { getAdminDb } from "../../../../lib/db";
import { config } from "../../../../lib/config";
import { DateTime } from "luxon";
import { checkRateLimit } from "../../../../lib/rate-limit";

function isAllowedCmeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host !== "cmegroup-tools.quikstrike.net") return false;
    if (!url.pathname.toLowerCase().includes("quikstrikeview.aspx")) return false;
    return true;
  } catch {
    return false;
  }
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function GET(req: NextRequest) {
  try {
    await assertAdmin(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const adminDb = getAdminDb();
  const { data, error } = await adminDb
    .from("cme_series_links")
    .select("trade_date_bkk,url,status,updated_at,updated_by")
    .order("trade_date_bkk", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest) {
  let authCtx: { userId: string; role: "admin" | "viewer"; email: string | null };
  try {
    authCtx = await assertAdmin(req);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clientIp = getClientIp(req);
  const rate = checkRateLimit(
    `admin_cme_link:${clientIp}`,
    config.adminApiRateLimitPerMinute,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "too many admin requests", retry_after_ms: rate.retryAfterMs },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = cmeLinkUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = {
    trade_date_bkk: parsed.data.effective_date_bkk,
    url: parsed.data.url,
    status: "active",
    updated_by: authCtx.email || authCtx.userId,
    updated_at: DateTime.utc().toISO()
  };

  if (!isAllowedCmeUrl(row.url)) {
    return NextResponse.json(
      { error: "invalid cme url: must be https://cmegroup-tools.quikstrike.net/...QuikStrikeView.aspx" },
      { status: 400 }
    );
  }

  const adminDb = getAdminDb();
  const cooldownStart = DateTime.utc().minus({ minutes: config.cmeLinkUpdateCooldownSeconds / 60 }).toISO();
  const updaterKey = authCtx.email || authCtx.userId;
  const { data: recentUpdate } = await adminDb
    .from("cme_series_links")
    .select("updated_at,updated_by")
    .eq("updated_by", updaterKey)
    .gte("updated_at", cooldownStart)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentUpdate) {
    return NextResponse.json(
      {
        error: `cme link update cooldown active (${config.cmeLinkUpdateCooldownSeconds}s)`
      },
      { status: 429 }
    );
  }

  const { error } = await adminDb.from("cme_series_links").upsert(row, { onConflict: "trade_date_bkk" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: row });
}
