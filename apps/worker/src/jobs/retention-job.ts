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

    const calls = [
      db.from("price_ticks").delete().lt("event_time_utc", structuredCutoff),
      db.from("relation_snapshots_30m").delete().lt("anchor_time_utc", structuredCutoff),
      db.from("cme_snapshots").delete().lt("snapshot_time_utc", structuredCutoff),
      db.from("artifact_files").delete().lt("expires_at", artifactCutoff),
      db.from("webhook_replay_guard").delete().lt("expires_at", DateTime.utc().toISO()),
      db.from("webhook_request_log").delete().lt("received_at", webhookLogCutoff)
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
