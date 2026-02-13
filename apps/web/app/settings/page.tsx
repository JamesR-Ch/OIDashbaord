"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { CompactTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/compact-table";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { fmtDateTime } from "../../lib/format";

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
  symbol_sessions?: Array<{
    symbol: string;
    open: boolean;
    reason: string;
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
    const res = await fetch("/api/settings/cme-link", { cache: "no-store" });
    const json = await res.json();
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
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
    const res = await fetch("/api/settings/system", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
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

    const res = await fetch("/api/settings/cme-link", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, effective_date_bkk: date })
    });

    const json = await res.json();
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.status === 403) {
      router.replace("/overview");
      return;
    }
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

    const res = await fetch("/api/settings/run-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job })
    });

    const json = await res.json();
    if (res.status === 401) {
      router.replace("/login");
      setRunningJob("");
      return;
    }
    if (res.status === 403) {
      router.replace("/overview");
      setRunningJob("");
      return;
    }
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
    <AppShell>
      <PageHeader title="Settings" subtitle="Admin only · uses current session cookie · operational control surface." />

      <section className="terminal-grid xl:grid-cols-2">
        <AnalyticsPanel title="Daily CME Link Update" subtitle="Admin only. Required after 05:30 GMT+7.">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="trade_date">Trade Date (BKK)</Label>
              <Input id="trade_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">QuikStrike URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://cmegroup-tools.quikstrike.net/..." />
            </div>
            <Button type="submit">Save Daily Link</Button>
            <p className="text-xs text-muted-foreground">{message}</p>
          </form>

          {latest ? (
            <div className="mt-3 rounded-lg border border-border bg-elevated/45 p-3 text-xs">
              <p><span className="text-muted-foreground">Latest Date:</span> {latest.trade_date_bkk}</p>
              <p><span className="text-muted-foreground">Status:</span> {latest.status}</p>
              <p><span className="text-muted-foreground">Updated At:</span> {fmtDateTime(latest.updated_at)}</p>
              <p><span className="text-muted-foreground">Updated By:</span> {latest.updated_by}</p>
            </div>
          ) : null}
        </AnalyticsPanel>

        <AnalyticsPanel title="Run Controls" subtitle="Last successful run should appear in Job Status panel.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={runningJob !== ""} onClick={() => runNow("relation")}>Run Relation Now</Button>
            <Button variant="secondary" disabled={runningJob !== ""} onClick={() => runNow("cme")}>Run CME Now</Button>
            <Button disabled={runningJob !== ""} onClick={() => runNow("both")}>Run Both Now</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{runNowMessage}</p>

          {alerts ? (
            <div className="mt-4 space-y-2 text-xs">
              <div className="rounded-md border border-border bg-elevated/45 p-2">
                Relation: {alerts.relation_stale ? "stale" : "ok"} · age={alerts.relation_age_min ?? "-"}m · status={alerts.relation_last_status || "-"}
              </div>
              <div className="rounded-md border border-border bg-elevated/45 p-2">
                CME: {alerts.cme_stale ? "stale" : "ok"} · age={alerts.cme_age_min ?? "-"}m · status={alerts.cme_last_status || "-"}
              </div>
            </div>
          ) : null}
        </AnalyticsPanel>
      </section>

      <section className="terminal-grid xl:grid-cols-2">
        <AnalyticsPanel title="Latest Job Status" subtitle="Worker execution log">
          <CompactTable>
            <THead>
              <TR><TH>Job</TH><TH>Status</TH><TH>Details</TH><TH>Started</TH><TH>Finished</TH></TR>
            </THead>
            <TBody>
              {recentJobs.map((job, idx) => (
                <TR key={`${job.job_name}-${job.started_at}-${idx}`}>
                  <TD>{job.job_name}</TD>
                  <TD>
                    <SignalChip
                      label={job.status}
                      tone={job.status === "success" ? "up" : job.status === "failed" ? "down" : "neutral"}
                    />
                  </TD>
                  <TD>{renderJobDetails(job)}</TD>
                  <TD>{fmtDateTime(job.started_at)}</TD>
                  <TD>{job.finished_at ? fmtDateTime(job.finished_at) : "-"}</TD>
                </TR>
              ))}
            </TBody>
          </CompactTable>
        </AnalyticsPanel>

        <AnalyticsPanel title="Worker Health" subtitle="Symbol sessions and runtime status">
          {!workerHealth ? (
            <p className="text-xs text-muted-foreground">Health telemetry unavailable.</p>
          ) : workerHealth.ok ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">Worker UTC: {workerHealth.now_utc ? fmtDateTime(workerHealth.now_utc) : "-"}</p>
              <CompactTable>
                <THead>
                  <TR><TH>Symbol</TH><TH>Mode</TH><TH>Open</TH><TH>Reason</TH></TR>
                </THead>
                <TBody>
                  {(workerHealth.symbol_sessions || []).map((row, idx) => (
                    <TR key={`${row.symbol}-${idx}`}>
                      <TD>{row.symbol}</TD>
                      <TD>{workerHealth.symbol_session_modes?.[row.symbol] || "auto"}</TD>
                      <TD>{row.open ? "yes" : "no"}</TD>
                      <TD>{row.reason}</TD>
                    </TR>
                  ))}
                </TBody>
              </CompactTable>
            </>
          ) : (
            <p className="text-xs text-danger-foreground">{workerHealth.error || "worker health check failed"}</p>
          )}
        </AnalyticsPanel>
      </section>

      <AnalyticsPanel title="Webhook Telemetry" subtitle="TradingView traffic and recent request status">
        {!webhookTelemetry ? (
          <p className="text-xs text-muted-foreground">Telemetry unavailable.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="rounded-md border border-border bg-elevated/45 p-2">Total: {webhookTelemetry.total}</div>
              <div className="rounded-md border border-border bg-elevated/45 p-2">2xx: {webhookTelemetry.success_2xx}</div>
              <div className="rounded-md border border-border bg-elevated/45 p-2">4xx: {webhookTelemetry.client_4xx}</div>
              <div className="rounded-md border border-border bg-elevated/45 p-2">5xx: {webhookTelemetry.server_5xx}</div>
            </div>

            <section className="terminal-grid md:grid-cols-2">
              <CompactTable>
                <THead><TR><TH>Top Note</TH><TH>Count</TH></TR></THead>
                <TBody>
                  {(webhookTelemetry.top_notes || []).map((row, idx) => (
                    <TR key={`${row.note}-${idx}`}><TD>{row.note}</TD><TD>{row.count}</TD></TR>
                  ))}
                </TBody>
              </CompactTable>

              <CompactTable>
                <THead><TR><TH>Time</TH><TH>Status</TH><TH>IP</TH><TH>Note</TH></TR></THead>
                <TBody>
                  {(webhookTelemetry.recent || []).map((row, idx) => (
                    <TR key={`${row.received_at}-${row.ip}-${idx}`}>
                      <TD>{fmtDateTime(row.received_at)}</TD>
                      <TD>{row.status_code}</TD>
                      <TD>{row.ip}</TD>
                      <TD>{row.note || "-"}</TD>
                    </TR>
                  ))}
                </TBody>
              </CompactTable>
            </section>
          </div>
        )}
      </AnalyticsPanel>
    </AppShell>
  );
}
