import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdmin, AuthError } from "../../../../lib/auth";
import { config } from "../../../../lib/config";
import { getAdminDb } from "../../../../lib/db";
import { DateTime } from "luxon";
import { checkRateLimit } from "../../../../lib/rate-limit";

const payloadSchema = z.object({
  job: z.enum(["relation", "cme", "both"])
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: NextRequest) {
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
    `admin_run_now:${clientIp}`,
    config.adminApiRateLimitPerMinute,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "too many admin requests", retry_after_ms: rate.retryAfterMs },
      { status: 429 }
    );
  }

  if (!config.workerControlSecret) {
    return NextResponse.json({ error: "worker control secret not configured" }, { status: 500 });
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

  const adminDb = getAdminDb();
  const cooldownStart = DateTime.utc().minus({ minutes: config.runNowCooldownSeconds / 60 }).toISO();
  const recentNames =
    parsed.data.job === "both"
      ? ["relation_30m", "cme_30m"]
      : parsed.data.job === "relation"
        ? ["relation_30m"]
        : ["cme_30m"];

  const { data: recentRuns, error: recentError } = await adminDb
    .from("job_runs")
    .select("job_name,started_at,status")
    .in("job_name", recentNames)
    .gte("started_at", cooldownStart)
    .order("started_at", { ascending: false })
    .limit(5);

  if (recentError) {
    return NextResponse.json({ error: `run-now cooldown check failed: ${recentError.message}` }, { status: 500 });
  }

  if ((recentRuns || []).length > 0) {
    return NextResponse.json(
      {
        error: `run-now cooldown active (${config.runNowCooldownSeconds}s)`,
        by: authCtx.email || authCtx.userId
      },
      { status: 429 }
    );
  }

  try {
    const response = await fetch(`${config.workerControlUrl}/run-now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": config.workerControlSecret
      },
      body: JSON.stringify(parsed.data)
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: json.error || "worker rejected request" },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true, data: json });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "worker unavailable" }, { status: 502 });
  }
}
