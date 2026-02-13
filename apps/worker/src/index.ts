import cron from "node-cron";
import { DateTime } from "luxon";
import http from "node:http";
import { SYMBOLS } from "@oid/shared";
import { workerConfig } from "./lib/config";
import { db } from "./lib/db";
import { logger } from "./services/logger";
import { runRelationJob } from "./jobs/relation-job";
import { runCmeExtractionJob } from "./jobs/cme-job";
import { runRetentionJob } from "./jobs/retention-job";
import { isSymbolMarketOpen } from "./services/cme-gates";

logger.info(
  {
    relationCron: workerConfig.relationCron,
    cmeCron: workerConfig.cmeCron,
    retentionCron: workerConfig.retentionCron,
    controlPort: workerConfig.controlPort
  },
  "worker booting"
);

const BKK_ZONE = "Asia/Bangkok";

type RunNowJob = "relation" | "cme" | "both";
type ManagedJob = "relation_30m" | "cme_30m" | "retention_cleanup";
const runningJobs = new Set<ManagedJob>();

async function markSkippedOverlap(jobName: ManagedJob, source: "cron" | "run_now") {
  try {
    const now = DateTime.utc().toISO();
    await db.from("job_runs").insert({
      job_name: jobName,
      status: "skipped",
      started_at: now,
      finished_at: now,
      metadata: {
        reason: "overlap_in_progress",
        source
      }
    });
  } catch (error) {
    logger.warn({ err: error, jobName, source }, "failed to write overlap skip record");
  }
}

async function runManagedJob(
  jobName: ManagedJob,
  source: "cron" | "run_now",
  fn: () => Promise<void>
) {
  if (runningJobs.has(jobName)) {
    logger.warn({ jobName, source }, "job skipped due to overlap");
    await markSkippedOverlap(jobName, source);
    return;
  }

  runningJobs.add(jobName);
  try {
    await fn();
  } finally {
    runningJobs.delete(jobName);
  }
}

async function runNow(job: RunNowJob) {
  const anchor = DateTime.now().setZone(BKK_ZONE).startOf("minute");
  if (job === "relation" || job === "both") {
    await runManagedJob("relation_30m", "run_now", () => runRelationJob(anchor));
  }
  if (job === "cme" || job === "both") {
    await runManagedJob("cme_30m", "run_now", () => runCmeExtractionJob(anchor));
  }
}

cron.schedule(workerConfig.relationCron, async () => {
  const anchor = DateTime.now().setZone(BKK_ZONE).startOf("minute");
  await runManagedJob("relation_30m", "cron", () => runRelationJob(anchor));
}, { timezone: BKK_ZONE });

cron.schedule(workerConfig.cmeCron, async () => {
  const anchor = DateTime.now().setZone(BKK_ZONE).startOf("minute");
  await runManagedJob("cme_30m", "cron", () => runCmeExtractionJob(anchor));
}, { timezone: BKK_ZONE });

cron.schedule(workerConfig.retentionCron, async () => {
  await runManagedJob("retention_cleanup", "cron", () => runRetentionJob());
}, { timezone: BKK_ZONE });

logger.info("worker schedulers registered");

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "GET" && req.url === "/health/details") {
    if (!workerConfig.controlSecret) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "worker control secret not configured" }));
      return;
    }

    const incomingSecret = req.headers["x-worker-secret"];
    if (incomingSecret !== workerConfig.controlSecret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }

    try {
      const { data, error } = await db
        .from("job_runs")
        .select("job_name,status,started_at,finished_at,error_message,metadata")
        .order("started_at", { ascending: false })
        .limit(30);

      if (error) throw error;

      const latestByJob = new Map<string, any>();
      for (const row of data || []) {
        if (!latestByJob.has(row.job_name)) {
          latestByJob.set(row.job_name, row);
        }
      }

      const nowMs = Date.now();
      const ageMin = (iso?: string) => {
        if (!iso) return null;
        const ms = new Date(iso).getTime();
        if (Number.isNaN(ms)) return null;
        return Math.max(0, Math.round((nowMs - ms) / 60000));
      };

      const relationLatest = latestByJob.get("relation_30m");
      const cmeLatest = latestByJob.get("cme_30m");
      const relationAgeMin = ageMin(relationLatest?.started_at);
      const cmeAgeMin = ageMin(cmeLatest?.started_at);
      const relationSkipReason = relationLatest?.metadata?.reason;
      const cmeSkipReason = cmeLatest?.metadata?.reason;
      const relationMarketClosedSkip =
        relationLatest?.status === "skipped" &&
        relationSkipReason === "relation_market_closed_or_insufficient_open_symbols";
      const cmeMarketClosedSkip =
        cmeLatest?.status === "skipped" &&
        cmeSkipReason === "cme_session_closed";
      const alerts = {
        relation_stale: relationMarketClosedSkip
          ? false
          : relationAgeMin == null ? true : relationAgeMin > workerConfig.relationStaleMinutes,
        cme_stale: cmeMarketClosedSkip
          ? false
          : cmeAgeMin == null ? true : cmeAgeMin > workerConfig.cmeStaleMinutes,
        relation_age_min: relationAgeMin,
        cme_age_min: cmeAgeMin,
        relation_last_status: relationLatest?.status || null,
        cme_last_status: cmeLatest?.status || null,
        relation_skip_reason: relationSkipReason || null,
        cme_skip_reason: cmeSkipReason || null
      };
      const symbolSessions = SYMBOLS.map((symbol) => ({
        symbol,
        ...isSymbolMarketOpen(symbol, DateTime.utc())
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          now_utc: DateTime.utc().toISO(),
          running_jobs: Array.from(runningJobs.values()),
          latest_jobs: Array.from(latestByJob.values()),
          alerts,
          symbol_sessions: symbolSessions,
          symbol_session_modes: workerConfig.symbolSessionModes
        })
      );
      return;
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: error?.message || "failed to load health details",
          running_jobs: Array.from(runningJobs.values())
        })
      );
      return;
    }
  }

  if (req.method !== "POST" || req.url !== "/run-now") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (!workerConfig.controlSecret) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "worker control secret not configured" }));
    return;
  }

  const incomingSecret = req.headers["x-worker-secret"];
  if (incomingSecret !== workerConfig.controlSecret) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  let rawBody = "";
  req.on("data", (chunk) => {
    rawBody += chunk;
  });

  req.on("end", async () => {
    try {
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const job = payload.job as RunNowJob;
      if (job !== "relation" && job !== "cme" && job !== "both") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "job must be one of: relation, cme, both" }));
        return;
      }

      await runNow(job);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, job }));
    } catch (error: any) {
      logger.error({ err: error }, "run-now endpoint failed");
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error?.message || "failed" }));
    }
  });
});

server.listen(workerConfig.controlPort, () => {
  logger.info({ port: workerConfig.controlPort }, "worker control server listening");
});
