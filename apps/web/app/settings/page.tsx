"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Separator } from "../../components/ui/separator";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { getAccessToken } from "../../lib/auth-client";
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
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Admin-only control plane: CME daily link, run-now triggers, health, and webhook telemetry."
      />

      <Card>
        <CardHeader>
          <CardTitle>CME Daily Link Update</CardTitle>
          <CardDescription>
            OI/Intraday worker is blocked until this link is updated for current BKK trade date after 05:30.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="trade_date">Trade Date (BKK)</Label>
                <Input id="trade_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="url">QuikStrike URL</Label>
                <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://cmegroup-tools.quikstrike.net/..." />
              </div>
            </div>
            <Button type="submit">Save Daily Link</Button>
            <p className="text-sm text-muted-foreground">{message}</p>
          </form>

          {latest ? (
            <div className="grid gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm md:grid-cols-2">
              <p><span className="text-muted-foreground">Latest Date:</span> {latest.trade_date_bkk}</p>
              <p><span className="text-muted-foreground">Status:</span> {latest.status}</p>
              <p><span className="text-muted-foreground">Updated At:</span> {fmtDateTime(latest.updated_at)}</p>
              <p><span className="text-muted-foreground">Updated By:</span> {latest.updated_by}</p>
            </div>
          ) : null}

          <Separator />

          <div>
            <h3 className="text-sm font-semibold">Run Jobs Now</h3>
            <p className="mt-1 text-xs text-muted-foreground">Admin-only immediate run without waiting for xx:00/xx:30.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={runningJob !== ""} onClick={() => runNow("relation")}>
                Run Relation Now
              </Button>
              <Button variant="secondary" disabled={runningJob !== ""} onClick={() => runNow("cme")}>
                Run CME Now
              </Button>
              <Button disabled={runningJob !== ""} onClick={() => runNow("both")}>
                Run Both Now
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{runNowMessage}</p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest Run Status</CardTitle>
            <CardDescription>Most recent worker executions from job_runs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="table-shell">
              <Table>
                <THead>
                  <TR>
                    <TH>Job</TH>
                    <TH>Status</TH>
                    <TH>Details</TH>
                    <TH>Started</TH>
                    <TH>Finished</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentJobs.map((job, idx) => (
                    <TR key={`${job.job_name}-${job.started_at}-${idx}`}>
                      <TD>{job.job_name}</TD>
                      <TD>
                        <Badge variant={job.status === "success" ? "success" : job.status === "failed" ? "warning" : "outline"}>
                          {job.status}
                        </Badge>
                      </TD>
                      <TD>{renderJobDetails(job)}</TD>
                      <TD>{fmtDateTime(job.started_at)}</TD>
                      <TD>{job.finished_at ? fmtDateTime(job.finished_at) : "-"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Alerts</CardTitle>
            <CardDescription>Staleness and latest run outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            {!alerts ? (
              <p className="text-sm text-muted-foreground">No alert state available.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="font-medium">Relation freshness</p>
                  <p className="mt-1 text-muted-foreground">
                    {alerts.relation_stale ? "stale" : "ok"} · age={alerts.relation_age_min ?? "-"} min · status={alerts.relation_last_status || "-"}
                    {alerts.relation_skip_reason ? ` · reason=${alerts.relation_skip_reason}` : ""}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="font-medium">CME freshness</p>
                  <p className="mt-1 text-muted-foreground">
                    {alerts.cme_stale ? "stale" : "ok"} · age={alerts.cme_age_min ?? "-"} min · status={alerts.cme_last_status || "-"}
                    {alerts.cme_skip_reason ? ` · reason=${alerts.cme_skip_reason}` : ""}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Worker Health</CardTitle>
            <CardDescription>Runtime health and symbol session status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!workerHealth ? (
              <p className="text-muted-foreground">Worker health telemetry unavailable.</p>
            ) : workerHealth.ok ? (
              <>
                <p><span className="text-muted-foreground">Worker UTC:</span> {workerHealth.now_utc ? fmtDateTime(workerHealth.now_utc) : "-"}</p>
                <p><span className="text-muted-foreground">Running jobs:</span> {workerHealth.running_jobs?.length ? workerHealth.running_jobs.join(", ") : "-"}</p>
                <div className="table-shell">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Symbol</TH>
                        <TH>Mode</TH>
                        <TH>Open</TH>
                        <TH>Reason</TH>
                      </TR>
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
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-danger-foreground">{workerHealth.error || "worker health check failed"}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook Telemetry</CardTitle>
            <CardDescription>TradingView webhook traffic and status distribution (1h)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!webhookTelemetry ? (
              <p className="text-sm text-muted-foreground">Telemetry unavailable (migration 005 required).</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div className="rounded-md border border-border bg-card/40 p-2"><span className="text-muted-foreground">Total:</span> {webhookTelemetry.total}</div>
                  <div className="rounded-md border border-border bg-card/40 p-2"><span className="text-muted-foreground">2xx:</span> {webhookTelemetry.success_2xx}</div>
                  <div className="rounded-md border border-border bg-card/40 p-2"><span className="text-muted-foreground">4xx:</span> {webhookTelemetry.client_4xx}</div>
                  <div className="rounded-md border border-border bg-card/40 p-2"><span className="text-muted-foreground">5xx:</span> {webhookTelemetry.server_5xx}</div>
                </div>

                <div className="table-shell">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Top Note</TH>
                        <TH>Count</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {(webhookTelemetry.top_notes || []).map((row, idx) => (
                        <TR key={`${row.note}-${idx}`}>
                          <TD>{row.note}</TD>
                          <TD>{row.count}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>

                <div className="table-shell">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Time</TH>
                        <TH>Status</TH>
                        <TH>IP</TH>
                        <TH>Note</TH>
                      </TR>
                    </THead>
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
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
