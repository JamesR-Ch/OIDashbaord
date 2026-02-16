"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { DecisionTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/decision-table";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { StateBlock } from "../../components/dashboard/state-block";
import { PageSection } from "../../components/layout/page-section";
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

interface AlertEventState {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  recommendation: string;
}

interface AuthSecurityState {
  active_lockouts: number;
  failed_attempts_24h: number;
  recent_lockouts: Array<{
    email: string;
    failed_attempts: number;
    locked_until: string | null;
    last_failed_at: string | null;
    updated_at: string;
  }>;
}

type AccessState = "ok" | "forbidden" | "expired" | "transient_error";

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
  const [url, setUrl] = useState("");
  const [date, setDate] = useState("");
  const [latest, setLatest] = useState<LinkState | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobRunState[]>([]);
  const [webhookTelemetry, setWebhookTelemetry] = useState<WebhookTelemetryState | null>(null);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthState | null>(null);
  const [alerts, setAlerts] = useState<AlertsState | null>(null);
  const [alertSummary, setAlertSummary] = useState<"critical" | "warning" | "ok" | null>(null);
  const [alertEvents, setAlertEvents] = useState<AlertEventState[]>([]);
  const [authSecurity, setAuthSecurity] = useState<AuthSecurityState | null>(null);
  const [message, setMessage] = useState("");
  const [runNowMessage, setRunNowMessage] = useState("");
  const [runningJob, setRunningJob] = useState<"relation" | "cme" | "both" | "">("");
  const [accessState, setAccessState] = useState<AccessState>("ok");
  const [accessMessage, setAccessMessage] = useState("");
  const currentRequestRef = useRef<Promise<void> | null>(null);
  const systemRequestRef = useRef<Promise<void> | null>(null);

  const handleAccessStatus = useCallback((status: number, fallback: string, detail?: string) => {
    if (status === 401) {
      setAccessState("expired");
      setAccessMessage("Session expired. Please sign in again.");
      return true;
    }
    if (status === 403) {
      setAccessState("forbidden");
      setAccessMessage("Admin role required.");
      return true;
    }
    if (status === 429) {
      setAccessState("transient_error");
      setAccessMessage(detail ? `Rate limited: ${detail}` : "Rate limited. Please retry shortly.");
      return false;
    }
    if (status >= 500) {
      setAccessState("transient_error");
      setAccessMessage(detail || fallback);
      return false;
    }
    setAccessState("ok");
    setAccessMessage("");
    return false;
  }, []);

  const loadCurrent = useCallback(async (signal?: AbortSignal) => {
    if (currentRequestRef.current) return currentRequestRef.current;

    const task = (async () => {
      try {
        const res = await fetch("/api/settings/cme-link", { cache: "no-store", signal });
        const json = await res.json().catch(() => ({}));
        const blocked = handleAccessStatus(res.status, "Unable to load latest CME link.", json.error);
        if (blocked) return;
        if (!res.ok) {
          setMessage(`error: ${json.error || "failed"}`);
          return;
        }
        setLatest(json.data || null);
        if (json.data?.url) setUrl(json.data.url);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setAccessState("transient_error");
        setAccessMessage("Failed to load settings. Please retry.");
      } finally {
        currentRequestRef.current = null;
      }
    })();

    currentRequestRef.current = task;
    return task;
  }, [handleAccessStatus]);

  const loadSystemStatus = useCallback(async (signal?: AbortSignal) => {
    if (systemRequestRef.current) return systemRequestRef.current;

    const task = (async () => {
      try {
        const res = await fetch("/api/settings/system", { cache: "no-store", signal });
        const json = await res.json().catch(() => ({}));
        const blocked = handleAccessStatus(res.status, "Unable to load system telemetry.", json.error);
        if (blocked || !res.ok) return;
        setRecentJobs(json.recent_jobs || []);
        setWebhookTelemetry(json.webhook_telemetry || null);
        setWorkerHealth(json.worker_health || null);
        setAlerts(json.alerts || null);
        setAlertSummary(json.alert_summary || null);
        setAlertEvents(Array.isArray(json.alert_events) ? json.alert_events : []);
        setAuthSecurity(json.auth_security || null);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        setAccessState("transient_error");
        setAccessMessage("Failed to load system telemetry. Please retry.");
      } finally {
        systemRequestRef.current = null;
      }
    })();

    systemRequestRef.current = task;
    return task;
  }, [handleAccessStatus]);

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
    const controller = new AbortController();
    void Promise.all([loadCurrent(controller.signal), loadSystemStatus(controller.signal)]);
    return () => controller.abort();
  }, [loadCurrent, loadSystemStatus]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("saving...");

    const res = await fetch("/api/settings/cme-link", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, effective_date_bkk: date })
    });

    const json = await res.json();
    const blocked = handleAccessStatus(res.status, "Unable to save CME link.", json.error);
    if (blocked) return;
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
    const blocked = handleAccessStatus(res.status, "Unable to trigger run.", json.error);
    if (blocked) {
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
      {accessState !== "ok" ? (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-foreground">
          {accessMessage}
        </div>
      ) : null}

      <div className="space-y-6 md:space-y-7">
      <PageSection className="xl:grid-cols-2">
        <AnalyticsPanel title="Daily CME Link Update" subtitle="Admin only. Required after 05:30 GMT+7.">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="trade_date">Trade Date (BKK)</Label>
              <Input
                id="trade_date"
                name="trade_date"
                autoComplete="off"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">QuikStrike URL</Label>
              <Input
                id="url"
                name="url"
                autoComplete="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://cmegroup-tools.quikstrike.net/..."
              />
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

        <AnalyticsPanel title="Run Controls" subtitle="Admin only. Trigger worker jobs with current session cookie.">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={runningJob !== ""} onClick={() => runNow("relation")}>Run Relation Now</Button>
            <Button variant="secondary" disabled={runningJob !== ""} onClick={() => runNow("cme")}>Run CME Now</Button>
            <Button disabled={runningJob !== ""} onClick={() => runNow("both")}>Run Both Now</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{runNowMessage}</p>

          {alerts ? (
            <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
              <StateBlock
                title={`Relation ${alerts.relation_stale ? "stale" : "ok"}`}
                detail={`age=${alerts.relation_age_min ?? "-"}m · status=${alerts.relation_last_status || "-"}`}
                tone={alerts.relation_stale ? "warning" : "success"}
              />
              <StateBlock
                title={`CME ${alerts.cme_stale ? "stale" : "ok"}`}
                detail={`age=${alerts.cme_age_min ?? "-"}m · status=${alerts.cme_last_status || "-"}`}
                tone={alerts.cme_stale ? "warning" : "success"}
              />
            </div>
          ) : (
            <StateBlock title="System alerts unavailable" detail="Waiting for worker/system telemetry." />
          )}
        </AnalyticsPanel>
      </PageSection>

      <PageSection className="xl:grid-cols-2">
        <AnalyticsPanel title="Latest Job Status" subtitle="Worker execution log">
          <DecisionTable>
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
          </DecisionTable>
        </AnalyticsPanel>

        <AnalyticsPanel title="Worker Health" subtitle="Symbol sessions and runtime status">
          {!workerHealth ? (
            <StateBlock title="Health telemetry unavailable" detail="Worker did not return details." />
          ) : workerHealth.ok ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">Worker UTC: {workerHealth.now_utc ? fmtDateTime(workerHealth.now_utc) : "-"}</p>
              <DecisionTable compact>
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
              </DecisionTable>
            </>
          ) : (
            <StateBlock tone="danger" title="Worker health failed" detail={workerHealth.error || "worker health check failed"} />
          )}
        </AnalyticsPanel>
      </PageSection>

      <AnalyticsPanel title="Login Abuse Monitoring" subtitle="Auth lockouts and failed login activity (24h)">
        {!authSecurity ? (
          <StateBlock title="Auth security telemetry unavailable" detail="auth_login_lockouts table not available or no data yet." />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <div className="rounded-md border border-border bg-elevated/45 p-2">Active lockouts: {authSecurity.active_lockouts}</div>
              <div className="rounded-md border border-border bg-elevated/45 p-2">Failed attempts (24h): {authSecurity.failed_attempts_24h}</div>
              <div className="rounded-md border border-border bg-elevated/45 p-2">Recent rows: {authSecurity.recent_lockouts.length}</div>
            </div>
            <DecisionTable compact>
              <THead><TR><TH>Email</TH><TH>Attempts</TH><TH>Locked Until</TH><TH>Last Failed</TH></TR></THead>
              <TBody>
                {authSecurity.recent_lockouts.length === 0 ? (
                  <TR><TD colSpan={4}>No recent lockout rows.</TD></TR>
                ) : authSecurity.recent_lockouts.map((row, idx) => (
                  <TR key={`${row.email}-${row.updated_at}-${idx}`}>
                    <TD>{row.email}</TD>
                    <TD>{row.failed_attempts}</TD>
                    <TD>{fmtDateTime(row.locked_until)}</TD>
                    <TD>{fmtDateTime(row.last_failed_at)}</TD>
                  </TR>
                ))}
              </TBody>
            </DecisionTable>
          </div>
        )}
      </AnalyticsPanel>

      <AnalyticsPanel
        title="System Alert Events"
        subtitle="Actionable observability feed (critical, warning, info)"
        rightSlot={
          alertSummary ? (
            <SignalChip
              label={alertSummary === "critical" ? "CRITICAL" : alertSummary === "warning" ? "WARNING" : "OK"}
              tone={alertSummary === "critical" ? "down" : alertSummary === "warning" ? "neutral" : "up"}
            />
          ) : null
        }
      >
        {alertEvents.length === 0 ? (
          <StateBlock title="No alert events" detail="System has not generated alert events yet." />
        ) : (
          <div className="space-y-2">
            {alertEvents.map((event) => (
              <div key={event.key} className="rounded-lg border border-border bg-elevated/45 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{event.title}</p>
                  <SignalChip
                    label={event.severity.toUpperCase()}
                    tone={event.severity === "critical" ? "down" : event.severity === "warning" ? "neutral" : "up"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{event.detail}</p>
                <p className="mt-1 text-xs">Action: {event.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </AnalyticsPanel>

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
              <DecisionTable compact>
                <THead><TR><TH>Top Note</TH><TH>Count</TH></TR></THead>
                <TBody>
                  {(webhookTelemetry.top_notes || []).map((row, idx) => (
                    <TR key={`${row.note}-${idx}`}><TD>{row.note}</TD><TD>{row.count}</TD></TR>
                  ))}
                </TBody>
              </DecisionTable>

              <DecisionTable compact>
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
              </DecisionTable>
            </section>
          </div>
        )}
      </AnalyticsPanel>
      </div>
    </AppShell>
  );
}
