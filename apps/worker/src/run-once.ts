import { DateTime } from "luxon";
import { runCmeExtractionJob } from "./jobs/cme-job";
import { runRelationJob } from "./jobs/relation-job";
import { runRetentionJob } from "./jobs/retention-job";
import { logger } from "./services/logger";

type JobArg = "relation" | "cme" | "retention" | "all";

async function main() {
  const arg = (process.argv[2] || "all") as JobArg;
  const anchor = DateTime.now().setZone("Asia/Bangkok").startOf("minute");

  logger.info({ arg, anchor: anchor.toISO() }, "run-once start");

  if (arg === "relation" || arg === "all") {
    await runRelationJob(anchor);
  }

  if (arg === "cme" || arg === "all") {
    await runCmeExtractionJob(anchor);
  }

  if (arg === "retention" || arg === "all") {
    await runRetentionJob();
  }

  logger.info("run-once done");
}

main().catch((error) => {
  logger.error({ err: error }, "run-once fatal");
  process.exit(1);
});
