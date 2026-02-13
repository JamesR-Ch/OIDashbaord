import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { assertAdmin, AuthError } from "../../../../lib/auth";
import { getAdminDb } from "../../../../lib/db";
import { config } from "../../../../lib/config";
import { DateTime } from "luxon";

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
  const oneHourAgoIso = DateTime.utc().minus({ hours: 1 }).toISO();

  const [
    { data: jobRuns },
    { data: links },
    totalLogCount,
    successLogCount,
    clientErrLogCount,
    serverErrLogCount,
    recentWebhookLogs,
    webhookNotes
  ] = await Promise.all([
    adminDb
      .from("job_runs")
      .select("job_name,status,started_at,finished_at,metadata,error_message")
      .order("started_at", { ascending: false })
      .limit(12),
    adminDb
      .from("cme_series_links")
      .select("trade_date_bkk,status,updated_at")
      .order("trade_date_bkk", { ascending: false })
      .limit(5),
    adminDb
      .from("webhook_request_log")
      .select("id", { count: "exact", head: true })
      .eq("source", "tradingview")
      .gte("received_at", oneHourAgoIso),
    adminDb
      .from("webhook_request_log")
      .select("id", { count: "exact", head: true })
      .eq("source", "tradingview")
      .gte("received_at", oneHourAgoIso)
      .gte("status_code", 200)
      .lt("status_code", 300),
    adminDb
      .from("webhook_request_log")
      .select("id", { count: "exact", head: true })
      .eq("source", "tradingview")
      .gte("received_at", oneHourAgoIso)
      .gte("status_code", 400)
      .lt("status_code", 500),
    adminDb
      .from("webhook_request_log")
      .select("id", { count: "exact", head: true })
      .eq("source", "tradingview")
      .gte("received_at", oneHourAgoIso)
      .gte("status_code", 500)
      .lt("status_code", 600),
    adminDb
      .from("webhook_request_log")
      .select("ip,status_code,note,received_at")
      .eq("source", "tradingview")
      .order("received_at", { ascending: false })
      .limit(10),
    adminDb
      .from("webhook_request_log")
      .select("note")
      .eq("source", "tradingview")
      .gte("received_at", oneHourAgoIso)
      .not("note", "is", null)
  ]);

  const telemetryTableMissing = [
    totalLogCount.error,
    successLogCount.error,
    clientErrLogCount.error,
    serverErrLogCount.error,
    recentWebhookLogs.error,
    webhookNotes.error
  ].some((err) => err?.code === "PGRST205");

  const noteCounts = new Map<string, number>();
  for (const row of webhookNotes.data || []) {
    const note = row.note || "";
    if (!note) continue;
    noteCounts.set(note, (noteCounts.get(note) || 0) + 1);
  }
  const topNotes = Array.from(noteCounts.entries())
    .map(([note, count]) => ({ note, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const nowMs = Date.now();
  const latestByJob = new Map<string, { started_at: string; status: string }>();
  for (const row of jobRuns || []) {
    if (!latestByJob.has(row.job_name)) {
      latestByJob.set(row.job_name, {
        started_at: row.started_at,
        status: row.status
      });
    }
  }

  function ageMinutes(iso?: string): number | null {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.round((nowMs - ms) / 60000));
  }

  const relationLatest = latestByJob.get("relation_30m");
  const cmeLatest = latestByJob.get("cme_30m");
  const relationAgeMin = ageMinutes(relationLatest?.started_at);
  const cmeAgeMin = ageMinutes(cmeLatest?.started_at);

  const alerts = {
    relation_stale: relationAgeMin == null ? true : relationAgeMin > 35,
    cme_stale: cmeAgeMin == null ? true : cmeAgeMin > 35,
    relation_last_status: relationLatest?.status || null,
    cme_last_status: cmeLatest?.status || null,
    relation_age_min: relationAgeMin,
    cme_age_min: cmeAgeMin
  };

  let workerHealth: {
    ok: boolean;
    now_utc?: string;
    running_jobs?: string[];
    latest_jobs?: Array<Record<string, unknown>>;
    symbol_sessions?: Array<Record<string, unknown>>;
    symbol_session_modes?: Record<string, string>;
    error?: string;
  } | null = null;

  if (config.workerControlUrl && config.workerControlSecret) {
    try {
      const resp = await fetch(`${config.workerControlUrl}/health/details`, {
        headers: { "x-worker-secret": config.workerControlSecret },
        cache: "no-store"
      });
      const json = await resp.json().catch(() => ({}));

      if (resp.ok) {
        workerHealth = {
          ok: true,
          now_utc: json.now_utc,
          running_jobs: Array.isArray(json.running_jobs) ? json.running_jobs : [],
          latest_jobs: Array.isArray(json.latest_jobs) ? json.latest_jobs : [],
          symbol_sessions: Array.isArray(json.symbol_sessions) ? json.symbol_sessions : [],
          symbol_session_modes:
            json.symbol_session_modes && typeof json.symbol_session_modes === "object"
              ? json.symbol_session_modes
              : {}
        };
        if (json.alerts && typeof json.alerts === "object") {
          Object.assign(alerts, json.alerts);
        }
      } else {
        workerHealth = {
          ok: false,
          error: json.error || `worker_health_http_${resp.status}`
        };
      }
    } catch (error: any) {
      workerHealth = {
        ok: false,
        error: error?.message || "worker health unavailable"
      };
    }
  }

  return NextResponse.json({
    retention_days_structured: 45,
    retention_days_artifacts: 1,
    recent_jobs: jobRuns || [],
    recent_cme_links: links || [],
    webhook_telemetry: telemetryTableMissing
      ? null
      : {
          window: "1h",
          total: totalLogCount.count || 0,
          success_2xx: successLogCount.count || 0,
          client_4xx: clientErrLogCount.count || 0,
          server_5xx: serverErrLogCount.count || 0,
          top_notes: topNotes,
          recent: recentWebhookLogs.data || []
        },
    worker_health: workerHealth,
    alerts
  });
}
