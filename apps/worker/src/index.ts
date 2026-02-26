import cron from "node-cron";
import { DateTime } from "luxon";
import http from "node:http";
import { SYMBOLS } from "@oid/shared";
import { workerConfig } from "./lib/config";
import { db } from "./lib/db";
import { logger } from "./services/logger";
import { isSymbolMarketOpen } from "./services/cme-gates";

logger.info(
  {
    relationEnabled: workerConfig.relationEnabled,
    relationCron: workerConfig.relationCron,
    cmeCron: workerConfig.cmeCron,
    retentionCron: workerConfig.retentionCron,
    controlPort: workerConfig.controlPort,
    maxUptimeHours: workerConfig.maxUptimeHours
  },
  "worker booting"
);

const BKK_ZONE = "Asia/Bangkok";

type RunNowJob = "relation" | "cme" | "both";
type ManagedJob = "relation_30m" | "cme_30m" | "retention_cleanup";
const runningJobs = new Set<ManagedJob>();
let recycleRequested = false;

async function runRelation(anchor: DateTime) {
  const { runRelationJob } = await import("./jobs/relation-job");
  await runRelationJob(anchor);
}

async function runCme(anchor: DateTime) {
  const { runCmeExtractionJob } = await import("./jobs/cme-job");
  await runCmeExtractionJob(anchor);
}

async function runRetention() {
  const { runRetentionJob } = await import("./jobs/retention-job");
  await runRetentionJob();
}

function maybeExitForRecycle() {
  if (!recycleRequested || runningJobs.size > 0) return;
  logger.warn({ runningJobs: Array.from(runningJobs.values()) }, "worker recycling due to max uptime");
  setTimeout(() => process.exit(0), 250);
}

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

async function markSkippedDisabledRelation(source: "cron" | "run_now") {
  try {
    const now = DateTime.utc().toISO();
    await db.from("job_runs").insert({
      job_name: "relation_30m",
      status: "skipped",
      started_at: now,
      finished_at: now,
      metadata: {
        reason: "relation_disabled",
        source
      }
    });
  } catch (error) {
    logger.warn({ err: error, source }, "failed to write relation disabled skip record");
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
    maybeExitForRecycle();
  }
}

async function runNow(job: RunNowJob) {
  if (recycleRequested) {
    throw new Error("worker_recycling_in_progress");
  }
  const anchor = DateTime.now().setZone(BKK_ZONE).startOf("minute");
  if (job === "relation" || job === "both") {
    if (workerConfig.relationEnabled) {
      await runManagedJob("relation_30m", "run_now", () => runRelation(anchor));
    } else {
      logger.info({ job }, "relation run requested but relation is disabled");
      await markSkippedDisabledRelation("run_now");
    }
  }
  if (job === "cme" || job === "both") {
    await runManagedJob("cme_30m", "run_now", () => runCme(anchor));
  }
}

if (workerConfig.relationEnabled) {
  cron.schedule(workerConfig.relationCron, async () => {
    if (recycleRequested) return;
    const anchor = DateTime.now().setZone(BKK_ZONE).startOf("minute");
    await runManagedJob("relation_30m", "cron", () => runRelation(anchor));
  }, { timezone: BKK_ZONE });
} else {
  logger.info("relation scheduler disabled (RELATION_ENABLED=false)");
}

cron.schedule(workerConfig.cmeCron, async () => {
  if (recycleRequested) return;
  const anchor = DateTime.now().setZone(BKK_ZONE).startOf("minute");
  await runManagedJob("cme_30m", "cron", () => runCme(anchor));
}, { timezone: BKK_ZONE });

cron.schedule(workerConfig.retentionCron, async () => {
  if (recycleRequested) return;
  await runManagedJob("retention_cleanup", "cron", () => runRetention());
}, { timezone: BKK_ZONE });

logger.info("worker schedulers registered");

if (workerConfig.maxUptimeHours > 0) {
  const maxUptimeMs = Math.round(workerConfig.maxUptimeHours * 60 * 60 * 1000);
  setTimeout(() => {
    recycleRequested = true;
    logger.warn({ maxUptimeHours: workerConfig.maxUptimeHours }, "max uptime reached; recycle requested");
    maybeExitForRecycle();
  }, maxUptimeMs);
}

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

      const relationLatest = workerConfig.relationEnabled ? latestByJob.get("relation_30m") : null;
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
        relation_stale: !workerConfig.relationEnabled
          ? false
          : relationMarketClosedSkip
          ? false
          : relationAgeMin == null ? true : relationAgeMin > workerConfig.relationStaleMinutes,
        cme_stale: cmeMarketClosedSkip
          ? false
          : cmeAgeMin == null ? true : cmeAgeMin > workerConfig.cmeStaleMinutes,
        relation_age_min: workerConfig.relationEnabled ? relationAgeMin : null,
        cme_age_min: cmeAgeMin,
        relation_last_status: workerConfig.relationEnabled ? relationLatest?.status || null : "disabled",
        cme_last_status: cmeLatest?.status || null,
        relation_skip_reason: workerConfig.relationEnabled ? relationSkipReason || null : "relation_disabled",
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
          recycle_requested: recycleRequested,
          max_uptime_hours: workerConfig.maxUptimeHours,
          latest_jobs: Array.from(latestByJob.values()),
          alerts,
          relation_enabled: workerConfig.relationEnabled,
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
