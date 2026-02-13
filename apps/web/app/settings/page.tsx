"use client";

import { TopNav } from "../../components/nav";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "../../lib/auth-client";

interface LinkState {
  trade_date_bkk: string;
  url: string;
  status: string;
  updated_at: string;
  updated_by: string;
}

interface JobRunState {
  job_name: string;
  status: "success" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  metadata?: Record<string, unknown> | null;
  error_message?: string | null;
}

interface WebhookLogState {
  ip: string;
  status_code: number;
  note: string | null;
  received_at: string;
}

interface WebhookTelemetryState {
  window: string;
  total: number;
  success_2xx: number;
  client_4xx: number;
  server_5xx: number;
  top_notes: Array<{ note: string; count: number }>;
  recent: WebhookLogState[];
}

interface WorkerHealthState {
  ok: boolean;
  now_utc?: string;
  running_jobs?: string[];
  latest_jobs?: JobRunState[];
  symbol_sessions?: Array<{
    symbol: string;
    open: boolean;
    reason: string;
    session_time: string;
  }>;
  symbol_session_modes?: Record<string, string>;
  error?: string;
}

interface AlertsState {
  relation_stale: boolean;
  cme_stale: boolean;
  relation_last_status: string | null;
  cme_last_status: string | null;
  relation_age_min: number | null;
  cme_age_min: number | null;
  relation_skip_reason?: string | null;
  cme_skip_reason?: string | null;
}

function renderJobDetails(job: JobRunState): string {
  const durationMs = typeof job.metadata?.duration_ms === "number" ? job.metadata.duration_ms : null;
  if (job.error_message) return job.error_message;
  const reason = job.metadata?.reason;
  if (typeof reason === "string" && reason.length > 0) {
    return durationMs != null ? `${reason} (${durationMs} ms)` : reason;
  }
  const gate = job.metadata?.gate;
  if (gate && typeof gate === "object") {
    const gateReason = (gate as { reason?: unknown }).reason;
    if (typeof gateReason === "string" && gateReason.length > 0) {
      return durationMs != null ? `gate:${gateReason} (${durationMs} ms)` : `gate:${gateReason}`;
    }
  }
  return durationMs != null ? `${durationMs} ms` : "-";
}

export default function SettingsPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [latest, setLatest] = useState<LinkState | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobRunState[]>([]);
  const [webhookTelemetry, setWebhookTelemetry] = useState<WebhookTelemetryState | null>(null);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthState | null>(null);
  const [alerts, setAlerts] = useState<AlertsState | null>(null);
  const [message, setMessage] = useState("");
  const [runNowMessage, setRunNowMessage] = useState("");
  const [runningJob, setRunningJob] = useState<"relation" | "cme" | "both" | "">("");

  async function loadCurrent() {
    const token = await getAccessToken();
    if (!token) {
      setMessage("No active session. Please sign in at /login.");
      router.replace("/login");
      return;
    }

    const res = await fetch("/api/settings/cme-link", {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const json = await res.json();
    if (res.status === 403) {
      router.replace("/overview");
      return;
    }
    if (!res.ok) {
      setMessage(`error: ${json.error || "failed"}`);
      return;
    }
    setLatest(json.data || null);
    if (json.data?.url) setUrl(json.data.url);
  }

  async function loadSystemStatus() {
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch("/api/settings/system", {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (res.status === 403) {
      router.replace("/overview");
      return;
    }
    const json = await res.json();
    if (!res.ok) return;
    setRecentJobs(json.recent_jobs || []);
    setWebhookTelemetry(json.webhook_telemetry || null);
    setWorkerHealth(json.worker_health || null);
    setAlerts(json.alerts || null);
  }

  useEffect(() => {
    loadCurrent();
    loadSystemStatus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("saving...");
    const token = await getAccessToken();
    if (!token) {
      setMessage("No active session. Please sign in at /login.");
      return;
    }

    const res = await fetch("/api/settings/cme-link", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        url,
        effective_date_bkk: date
      })
    });

    const json = await res.json();

    if (!res.ok) {
      setMessage(`error: ${json.error || "failed"}`);
      return;
    }

    setMessage("saved");
    loadCurrent();
    loadSystemStatus();
  }

  async function runNow(job: "relation" | "cme" | "both") {
    setRunningJob(job);
    setRunNowMessage(`running ${job}...`);

    const token = await getAccessToken();
    if (!token) {
      setRunNowMessage("No active session. Please sign in at /login.");
      setRunningJob("");
      return;
    }

    const res = await fetch("/api/settings/run-now", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ job })
    });

    const json = await res.json();
    if (!res.ok) {
      setRunNowMessage(`error: ${json.error || "failed"}`);
      setRunningJob("");
      return;
    }

    setRunNowMessage(`success: ${job} triggered`);
    setRunningJob("");
    loadSystemStatus();
  }

  return (
    <main className="container">
      <TopNav />

      <section className="card" style={{ maxWidth: 760 }}>
        <h2>CME Daily Link Update</h2>
        <p style={{ color: "var(--muted)", marginTop: 6 }}>
          OI/Intraday worker is hard-blocked until this link is updated for the current BKK trade date after 05:30.
        </p>

        <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
          <div className="grid cols-2">
            <div>
              <label htmlFor="trade_date">Trade Date (BKK)</label>
              <input id="trade_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label htmlFor="url">QuikStrike URL</label>
            <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://cmegroup-tools.quikstrike.net/..." />
          </div>

          <button style={{ marginTop: 12 }} type="submit">Save Daily Link</button>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>{message}</p>
        </form>

        {latest ? (
          <dl className="kv">
            <dt>Latest Date</dt>
            <dd>{latest.trade_date_bkk}</dd>
            <dt>Status</dt>
            <dd>{latest.status}</dd>
            <dt>Updated At</dt>
            <dd>{new Date(latest.updated_at).toLocaleString()}</dd>
            <dt>Updated By</dt>
            <dd>{latest.updated_by}</dd>
          </dl>
        ) : null}

        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <h3>Run Jobs Now</h3>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            Admin-only immediate run. This triggers worker jobs without waiting for xx:00/xx:30.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={runningJob !== ""} onClick={() => runNow("relation")}>
              Run Relation Now
            </button>
            <button type="button" disabled={runningJob !== ""} onClick={() => runNow("cme")}>
              Run CME Now
            </button>
            <button type="button" disabled={runningJob !== ""} onClick={() => runNow("both")}>
              Run Both Now
            </button>
          </div>
          <p style={{ marginTop: 8, color: "var(--muted)" }}>{runNowMessage}</p>
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <h3>Latest Run Status</h3>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            Most recent worker executions from `job_runs`.
          </p>
          {!recentJobs.length ? (
            <p style={{ marginTop: 8, color: "var(--muted)" }}>No job data yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Details</th>
                  <th>Started</th>
                  <th>Finished</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job, idx) => (
                  <tr key={`${job.job_name}-${job.started_at}-${idx}`}>
                    <td>{job.job_name}</td>
                    <td className={job.status === "success" ? "badge-ok" : job.status === "failed" ? "badge-warn" : ""}>
                      {job.status}
                    </td>
                    <td>{renderJobDetails(job)}</td>
                    <td>{new Date(job.started_at).toLocaleString()}</td>
                    <td>{job.finished_at ? new Date(job.finished_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <h3>System Alerts</h3>
          {!alerts ? (
            <p style={{ marginTop: 8, color: "var(--muted)" }}>No alert state available.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>State</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Relation freshness</td>
                  <td className={alerts.relation_stale ? "badge-warn" : "badge-ok"}>
                    {alerts.relation_stale ? "stale" : "ok"}
                  </td>
                  <td>
                    age={alerts.relation_age_min ?? "-"} min, status={alerts.relation_last_status || "-"}
                    {alerts.relation_skip_reason ? `, reason=${alerts.relation_skip_reason}` : ""}
                  </td>
                </tr>
                <tr>
                  <td>CME freshness</td>
                  <td className={alerts.cme_stale ? "badge-warn" : "badge-ok"}>
                    {alerts.cme_stale ? "stale" : "ok"}
                  </td>
                  <td>
                    age={alerts.cme_age_min ?? "-"} min, status={alerts.cme_last_status || "-"}
                    {alerts.cme_skip_reason ? `, reason=${alerts.cme_skip_reason}` : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <h3>Worker Health</h3>
          {!workerHealth ? (
            <p style={{ marginTop: 8, color: "var(--muted)" }}>Worker health telemetry unavailable.</p>
          ) : workerHealth.ok ? (
            <>
              <p style={{ color: "var(--muted)", marginTop: 6 }}>
                Worker UTC time: {workerHealth.now_utc ? new Date(workerHealth.now_utc).toLocaleString() : "-"}
              </p>
              <p style={{ marginTop: 6 }}>
                Running jobs: {workerHealth.running_jobs?.length ? workerHealth.running_jobs.join(", ") : "-"}
              </p>
              <h4 style={{ marginTop: 12 }}>Symbol Session Status</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Mode</th>
                    <th>Open</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(workerHealth.symbol_sessions || []).map((row, idx) => (
                    <tr key={`${row.symbol}-${idx}`}>
                      <td>{row.symbol}</td>
                      <td>{workerHealth.symbol_session_modes?.[row.symbol] || "auto"}</td>
                      <td className={row.open ? "badge-ok" : "badge-warn"}>{row.open ? "yes" : "no"}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="badge-warn" style={{ marginTop: 8 }}>
              {workerHealth.error || "worker health check failed"}
            </p>
          )}
        </div>

        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <h3>Webhook Telemetry</h3>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            TradingView webhook traffic and response distribution in last 1 hour.
          </p>
          {!webhookTelemetry ? (
            <p style={{ marginTop: 8, color: "var(--muted)" }}>
              Telemetry unavailable (run migration 005 and ensure webhook traffic exists).
            </p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Total</th>
                    <th>2xx</th>
                    <th>4xx</th>
                    <th>5xx</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{webhookTelemetry.total}</td>
                    <td className="badge-ok">{webhookTelemetry.success_2xx}</td>
                    <td>{webhookTelemetry.client_4xx}</td>
                    <td className={webhookTelemetry.server_5xx > 0 ? "badge-warn" : ""}>{webhookTelemetry.server_5xx}</td>
                  </tr>
                </tbody>
              </table>

              <h4 style={{ marginTop: 12 }}>Top Webhook Notes (1h)</h4>
              {!webhookTelemetry.top_notes.length ? (
                <p style={{ marginTop: 8, color: "var(--muted)" }}>No note data in last hour.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Note</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookTelemetry.top_notes.map((row, idx) => (
                      <tr key={`${row.note}-${idx}`}>
                        <td>{row.note}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h4 style={{ marginTop: 12 }}>Recent Webhook Requests</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>IP</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {webhookTelemetry.recent.map((row, idx) => (
                    <tr key={`${row.received_at}-${row.ip}-${idx}`}>
                      <td>{new Date(row.received_at).toLocaleString()}</td>
                      <td className={row.status_code >= 500 ? "badge-warn" : row.status_code < 300 ? "badge-ok" : ""}>
                        {row.status_code}
                      </td>
                      <td>{row.ip}</td>
                      <td>{row.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
