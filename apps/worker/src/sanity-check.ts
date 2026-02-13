import { db } from "./lib/db";
import { SYMBOLS } from "@oid/shared";
import { workerConfig } from "./lib/config";
import { isSymbolMarketOpen } from "./services/cme-gates";
import { DateTime } from "luxon";

async function main() {
  const [jobsRes, cmeRes, relationRes, pricesRes, deltaRes, topChangeRes] = await Promise.all([
    db
      .from("job_runs")
      .select("job_name,status,started_at,finished_at,error_message,metadata")
      .order("started_at", { ascending: false })
      .limit(6),
    db
      .from("cme_snapshots")
      .select("snapshot_time_bkk,view_type,series_name,series_expiration_date,series_dte")
      .order("snapshot_time_utc", { ascending: false })
      .limit(4),
    db
      .from("relation_snapshots_30m")
      .select("anchor_time_bkk,quality_flags")
      .order("anchor_time_utc", { ascending: false })
      .limit(2),
    db
      .from("price_ticks")
      .select("symbol,price,event_time_bkk")
      .order("event_time_utc", { ascending: false })
      .limit(6),
    db
      .from("cme_snapshot_deltas")
      .select("id,snapshot_time_bkk,view_type,series_name,put_change,call_change,vol_change,future_change")
      .order("snapshot_time_utc", { ascending: false })
      .limit(4),
    db
      .from("cme_top_strike_changes")
      .select("delta_id,rank,strike,put_change,call_change,total_change")
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  if (jobsRes.error) throw jobsRes.error;
  if (cmeRes.error) throw cmeRes.error;
  if (relationRes.error) throw relationRes.error;
  if (pricesRes.error) throw pricesRes.error;
  if (deltaRes.error) throw deltaRes.error;
  if (topChangeRes.error) throw topChangeRes.error;

  console.log("=== Latest job runs ===");
  for (const row of jobsRes.data || []) {
    const detail = row.error_message || (row.metadata as any)?.reason || "";
    console.log(`${row.started_at} | ${row.job_name} | ${row.status}${detail ? ` | ${detail}` : ""}`);
  }

  console.log("\n=== Latest CME snapshots ===");
  for (const row of cmeRes.data || []) {
    console.log(`${row.snapshot_time_bkk} | ${row.view_type} | ${row.series_name} | exp=${row.series_expiration_date || "-"} | dte=${row.series_dte ?? "-"}`);
  }

  console.log("\n=== Latest relation snapshots ===");
  for (const row of relationRes.data || []) {
    console.log(`${row.anchor_time_bkk} | flags=${JSON.stringify(row.quality_flags || {})}`);
  }

  console.log("\n=== Latest prices ===");
  for (const row of pricesRes.data || []) {
    console.log(`${row.event_time_bkk} | ${row.symbol} | ${row.price}`);
  }

  console.log("\n=== Latest CME deltas ===");
  for (const row of deltaRes.data || []) {
    console.log(
      `${row.snapshot_time_bkk} | ${row.view_type} | ${row.series_name} | putΔ=${row.put_change} | callΔ=${row.call_change} | volΔ=${row.vol_change ?? "-"} | futΔ=${row.future_change ?? "-"}`
    );
  }

  const topByDelta = new Map<string, Array<any>>();
  for (const row of topChangeRes.data || []) {
    const arr = topByDelta.get(row.delta_id) || [];
    arr.push(row);
    topByDelta.set(row.delta_id, arr);
  }
  console.log("\n=== Top strike changes (latest deltas) ===");
  for (const delta of deltaRes.data || []) {
    const rows = (topByDelta.get(delta.id) || []).sort((a, b) => a.rank - b.rank);
    if (!rows.length) continue;
    console.log(`delta=${delta.id} (${delta.view_type} ${delta.series_name})`);
    for (const row of rows) {
      console.log(`  #${row.rank} strike=${row.strike} putΔ=${row.put_change} callΔ=${row.call_change} totalΔ=${row.total_change}`);
    }
  }

  console.log("\n=== Symbol sessions now ===");
  const nowUtc = DateTime.utc();
  for (const symbol of SYMBOLS) {
    const state = isSymbolMarketOpen(symbol, nowUtc);
    const mode = workerConfig.symbolSessionModes[symbol];
    console.log(`${symbol} | mode=${mode} | open=${state.open} | reason=${state.reason}`);
  }
}

main().catch((error) => {
  console.error("sanity-check failed:", error?.message || error);
  process.exit(1);
});
