import { DateTime } from "luxon";
import { db } from "../lib/db";
import { workerConfig } from "../lib/config";
import { isCmeJobAllowed } from "../services/cme-gates";
import { extractQuikStrikeView } from "../services/quikstrike-extractor";
import { logger } from "../services/logger";
import { withRetry } from "../services/retry";
import { buildTopPositiveStrikeChanges } from "../services/cme-change";

function topThreeBars(bars: Array<{ strike: number; put: number; call: number; volSettle: number | null }>) {
  return [...bars]
    .map((b) => ({ ...b, total: b.put + b.call }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((b, idx) => ({
      rank: (idx + 1) as 1 | 2 | 3,
      strike: b.strike,
      put: b.put,
      call: b.call,
      total: b.total,
      vol_settle: b.volSettle ?? null
    }));
}

function toNumberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function persistSnapshotChanges(params: {
  snapshotId: string;
  snapshotTimeUtc: string;
  snapshotTimeBkk: string;
  viewType: "intraday" | "oi";
  seriesName: string;
  putTotal: number;
  callTotal: number;
  vol: number | null;
  futureChg: number | null;
  bars: Array<{ strike: number; put: number; call: number; volSettle: number | null }>;
}) {
  const { data: previousSnapshot } = await db
    .from("cme_snapshots")
    .select("id,snapshot_time_utc,snapshot_time_bkk,put_total,call_total,vol,future_chg")
    .eq("view_type", params.viewType)
    .eq("series_name", params.seriesName)
    .lt("snapshot_time_utc", params.snapshotTimeUtc)
    .order("snapshot_time_utc", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!previousSnapshot?.id) return;

  const { data: previousBars } = await db
    .from("cme_strike_bars")
    .select("strike,put,call")
    .eq("snapshot_id", previousSnapshot.id);

  const { data: insertedDelta, error: deltaError } = await db
    .from("cme_snapshot_deltas")
    .upsert(
      {
        current_snapshot_id: params.snapshotId,
        previous_snapshot_id: previousSnapshot.id,
        previous_snapshot_time_utc: previousSnapshot.snapshot_time_utc,
        previous_snapshot_time_bkk: previousSnapshot.snapshot_time_bkk,
        view_type: params.viewType,
        snapshot_time_utc: params.snapshotTimeUtc,
        snapshot_time_bkk: params.snapshotTimeBkk,
        series_name: params.seriesName,
        put_before: toNumberOrZero(previousSnapshot.put_total),
        put_now: toNumberOrZero(params.putTotal),
        put_change: toNumberOrZero(params.putTotal) - toNumberOrZero(previousSnapshot.put_total),
        call_before: toNumberOrZero(previousSnapshot.call_total),
        call_now: toNumberOrZero(params.callTotal),
        call_change: toNumberOrZero(params.callTotal) - toNumberOrZero(previousSnapshot.call_total),
        vol_before: previousSnapshot.vol,
        vol_now: params.vol,
        vol_change: toNumberOrZero(params.vol) - toNumberOrZero(previousSnapshot.vol),
        future_before: previousSnapshot.future_chg,
        future_now: params.futureChg,
        future_change: toNumberOrZero(params.futureChg) - toNumberOrZero(previousSnapshot.future_chg)
      },
      { onConflict: "current_snapshot_id" }
    )
    .select("id")
    .single();

  if (deltaError || !insertedDelta?.id) throw deltaError || new Error("failed_to_persist_cme_snapshot_deltas");

  const changes = buildTopPositiveStrikeChanges(
    (previousBars || []).map((row: any) => ({
      strike: Number(row.strike),
      put: toNumberOrZero(row.put),
      call: toNumberOrZero(row.call)
    })),
    (params.bars || []).map((row) => ({
      strike: Number(row.strike),
      put: toNumberOrZero(row.put),
      call: toNumberOrZero(row.call)
    })),
    3
  );

  const { error: cleanupError } = await db
    .from("cme_top_strike_changes")
    .delete()
    .eq("delta_id", insertedDelta.id);
  if (cleanupError) throw cleanupError;

  if (changes.length > 0) {
    const rows = changes.map((row, idx) => ({
      delta_id: insertedDelta.id,
      rank: idx + 1,
      strike: row.strike,
      put_before: row.put_before,
      put_now: row.put_now,
      put_change: row.put_change,
      call_before: row.call_before,
      call_now: row.call_now,
      call_change: row.call_change,
      total_before: row.total_before,
      total_now: row.total_now,
      total_change: row.total_change
    }));
    const { error: topChangeError } = await db.from("cme_top_strike_changes").insert(rows);
    if (topChangeError) throw topChangeError;
  }
}

async function findNearestXauPrice(anchorUtcIso: string): Promise<number | null> {
  const { data } = await db
    .from("price_ticks")
    .select("price,event_time_utc")
    .eq("symbol", "XAUUSD")
    .lte("event_time_utc", anchorUtcIso)
    .order("event_time_utc", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.price ?? null;
}

export async function runCmeExtractionJob(anchorTimeBkk = DateTime.now().setZone("Asia/Bangkok")) {
  const startedMs = Date.now();
  const startedAt = DateTime.utc();
  const started = startedAt.toISO();
  const viewDiagnostics: Array<{
    view: "intraday" | "oi";
    series: string;
    expiration_date: string | null;
    dte: number | null;
    bars: number;
    put_total: number;
    call_total: number;
  }> = [];

  try {
    const gate = await isCmeJobAllowed(anchorTimeBkk);
    if (!gate.allowed || !gate.url) {
      const finishedAt = DateTime.utc();
      await db.from("job_runs").insert({
        job_name: "cme_30m",
        status: "skipped",
        started_at: started,
        finished_at: finishedAt.toISO(),
        metadata: {
          reason: gate.reason,
          gate: gate.details || null,
          duration_ms: Math.max(0, Date.now() - startedMs)
        }
      });
      return;
    }

    const anchorUtc = anchorTimeBkk.toUTC().startOf("minute");
    const tradeDateBkk = gate.tradeDate || anchorTimeBkk.toISODate() || "";
    const xauPrice = await findNearestXauPrice(anchorUtc.toISO() || "");

    const extractedCounts: Record<"intraday" | "oi", number> = {
      intraday: 0,
      oi: 0
    };

    for (const viewType of ["intraday", "oi"] as const) {
      const extracted = await withRetry(
        `cme_extract_${viewType}`,
        () => extractQuikStrikeView(gate.url, viewType, tradeDateBkk),
        workerConfig.cmeExtractMaxAttempts,
        workerConfig.cmeExtractRetryDelayMs
      );

      const { data: inserted, error: snapshotError } = await db
        .from("cme_snapshots")
        .upsert(
          {
            snapshot_time_utc: anchorUtc.toISO(),
            snapshot_time_bkk: anchorTimeBkk.toISO(),
            trade_date_bkk: gate.tradeDate,
            series_name: extracted.seriesName,
            series_expiration_label: extracted.expirationLabel,
            series_expiration_date: extracted.expirationDate,
            series_dte: extracted.dte,
            view_type: viewType,
            put_total: extracted.putTotal,
            call_total: extracted.callTotal,
            vol: extracted.vol,
            vol_chg: extracted.volChg,
            future_chg: extracted.futureChg,
            xauusd_price_at_snapshot: xauPrice,
            source_url: gate.url
          },
          { onConflict: "snapshot_time_utc,view_type" }
        )
        .select("id")
        .single();

      if (snapshotError) throw snapshotError;

      const snapshotId = inserted.id;
      const { error: cleanupBarsError } = await db.from("cme_strike_bars").delete().eq("snapshot_id", snapshotId);
      if (cleanupBarsError) throw cleanupBarsError;

      const { error: cleanupTopError } = await db.from("cme_top_actives").delete().eq("snapshot_id", snapshotId);
      if (cleanupTopError) throw cleanupTopError;

      const bars = extracted.bars.map((bar) => ({
        snapshot_id: snapshotId,
        strike: bar.strike,
        put: bar.put,
        call: bar.call,
        vol_settle: bar.volSettle,
        total_activity: bar.put + bar.call
      }));

      if (bars.length > 0) {
        const { error: barsError } = await db.from("cme_strike_bars").insert(bars);
        if (barsError) throw barsError;
      }
      extractedCounts[viewType] = bars.length;
      viewDiagnostics.push({
        view: viewType,
        series: extracted.seriesName,
        expiration_date: extracted.expirationDate,
        dte: extracted.dte,
        bars: bars.length,
        put_total: extracted.putTotal,
        call_total: extracted.callTotal
      });

      const topThree = topThreeBars(extracted.bars).map((row) => ({
        snapshot_id: snapshotId,
        rank: row.rank,
        strike: row.strike,
        put: row.put,
        call: row.call,
        total: row.total,
        vol_settle: row.vol_settle
      }));

      if (topThree.length > 0) {
        const { error: topError } = await db.from("cme_top_actives").insert(topThree);
        if (topError) throw topError;
      }

      await persistSnapshotChanges({
        snapshotId,
        snapshotTimeUtc: anchorUtc.toISO() || "",
        snapshotTimeBkk: anchorTimeBkk.toISO() || "",
        viewType,
        seriesName: extracted.seriesName,
        putTotal: extracted.putTotal,
        callTotal: extracted.callTotal,
        vol: extracted.vol,
        futureChg: extracted.futureChg,
        bars: extracted.bars
      });
    }

    const finishedAt = DateTime.utc();
    await db.from("job_runs").insert({
      job_name: "cme_30m",
      status: "success",
      started_at: started,
      finished_at: finishedAt.toISO(),
      metadata: {
        anchor_time_bkk: anchorTimeBkk.toISO(),
        gate: gate.details || null,
        bars_per_view: extractedCounts,
        views: viewDiagnostics,
        retry: {
          attempts: workerConfig.cmeExtractMaxAttempts,
          base_delay_ms: workerConfig.cmeExtractRetryDelayMs
        },
        duration_ms: Math.max(0, Date.now() - startedMs)
      }
    });
  } catch (error: any) {
    logger.error({ err: error }, "cme job failed");
    const finishedAt = DateTime.utc();
    await db.from("job_runs").insert({
      job_name: "cme_30m",
      status: "failed",
      started_at: started,
      finished_at: finishedAt.toISO(),
      metadata: {
        views: viewDiagnostics,
        duration_ms: Math.max(0, Date.now() - startedMs)
      },
      error_message: error?.message || "unknown error"
    });
  }
}
