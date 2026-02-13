import { DateTime } from "luxon";
import { db } from "../lib/db";
import { logger } from "../services/logger";
import { workerConfig } from "../lib/config";

export async function runRetentionJob() {
  const startedMs = Date.now();
  const startedAt = DateTime.utc();
  const started = startedAt.toISO();

  try {
    const structuredCutoff = DateTime.utc().minus({ days: 45 }).toISO();
    const artifactCutoff = DateTime.utc().minus({ days: 1 }).toISO();
    const webhookLogCutoff = DateTime.utc().minus({ days: workerConfig.webhookLogRetentionDays }).toISO();
    const jobRunsCutoff = DateTime.utc().minus({ days: workerConfig.jobRunsRetentionDays }).toISO();
    const authLockoutsCutoff = DateTime.utc().minus({ days: workerConfig.authLockoutsRetentionDays }).toISO();
    const cmeSeriesLinksCutoffDate = DateTime.utc()
      .setZone("Asia/Bangkok")
      .minus({ days: workerConfig.cmeSeriesLinksRetentionDays })
      .toISODate();

    const calls = [
      db.from("price_ticks").delete().lt("event_time_utc", structuredCutoff),
      db.from("relation_snapshots_30m").delete().lt("anchor_time_utc", structuredCutoff),
      db.from("cme_snapshots").delete().lt("snapshot_time_utc", structuredCutoff),
      db.from("artifact_files").delete().lt("expires_at", artifactCutoff),
      db.from("webhook_replay_guard").delete().lt("expires_at", DateTime.utc().toISO()),
      db.from("webhook_request_log").delete().lt("received_at", webhookLogCutoff),
      db.from("job_runs").delete().lt("started_at", jobRunsCutoff),
      db
        .from("auth_login_lockouts")
        .delete()
        .or(`updated_at.lt.${authLockoutsCutoff},and(locked_until.is.null,last_failed_at.lt.${authLockoutsCutoff})`),
      db.from("cme_series_links").delete().lt("trade_date_bkk", cmeSeriesLinksCutoffDate)
    ];

    await Promise.all(calls);

    const finishedAt = DateTime.utc();
    await db.from("job_runs").insert({
      job_name: "retention_cleanup",
      status: "success",
      started_at: started,
      finished_at: finishedAt.toISO(),
      metadata: {
        structured_cutoff: structuredCutoff,
        artifact_cutoff: artifactCutoff,
        webhook_log_cutoff: webhookLogCutoff,
        job_runs_cutoff: jobRunsCutoff,
        auth_lockouts_cutoff: authLockoutsCutoff,
        cme_series_links_cutoff_date: cmeSeriesLinksCutoffDate,
        duration_ms: Math.max(0, Date.now() - startedMs)
      }
    });
  } catch (error: any) {
    logger.error({ err: error }, "retention job failed");
    const finishedAt = DateTime.utc();
    await db.from("job_runs").insert({
      job_name: "retention_cleanup",
      status: "failed",
      started_at: started,
      finished_at: finishedAt.toISO(),
      metadata: {
        duration_ms: Math.max(0, Date.now() - startedMs)
      },
      error_message: error?.message || "unknown error"
    });
  }
}
