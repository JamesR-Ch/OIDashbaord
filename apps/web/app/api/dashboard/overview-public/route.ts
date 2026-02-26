import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/db";
import { DateTime } from "luxon";
import { getDashboardMarketStatus } from "../../../../lib/market-status";

const PRICE_LOOKBACK_ROWS = 36;
const CME_SNAPSHOT_LOOKBACK_ROWS = 6;
const CME_TIMELINE_MAX_SETS = 8;

export async function GET(req: NextRequest) {
  const adminDb = getAdminDb();
  const at = req.nextUrl.searchParams.get("at");
  const anchor = at
    ? DateTime.fromISO(at, { zone: "utc" })
    : DateTime.now().toUTC();

  const [pricesRes, cmeRes, cmeDeltaRes] = await Promise.all([
    adminDb
      .from("price_ticks")
      .select("symbol,price,event_time_utc,event_time_bkk")
      .lte("event_time_utc", anchor.toISO())
      .order("event_time_utc", { ascending: false })
      .limit(PRICE_LOOKBACK_ROWS),
    adminDb
      .from("cme_snapshots")
      .select("*")
      .order("snapshot_time_utc", { ascending: false })
      .limit(CME_SNAPSHOT_LOOKBACK_ROWS),
    adminDb
      .from("cme_snapshot_deltas")
      .select("*")
      .order("snapshot_time_utc", { ascending: false })
      .limit(4)
  ]);

  const latestByView = new Map<"intraday" | "oi", any>();
  for (const row of cmeRes.data || []) {
    if ((row.view_type === "intraday" || row.view_type === "oi") && !latestByView.has(row.view_type)) {
      latestByView.set(row.view_type, row);
    }
  }

  const timelineGroups = await Promise.all(
    Array.from(latestByView.values()).map(async (latest) => {
      const { data } = await adminDb
        .from("cme_snapshots")
        .select("*")
        .eq("view_type", latest.view_type)
        .eq("trade_date_bkk", latest.trade_date_bkk)
        .eq("series_name", latest.series_name)
        .lte("snapshot_time_utc", anchor.toISO())
        .order("snapshot_time_utc", { ascending: false })
        .limit(CME_TIMELINE_MAX_SETS);
      return data || [];
    })
  );
  const cmeTimelineSnapshots = timelineGroups.flat();

  const snapshotIds = Array.from(
    new Set([...(cmeRes.data || []).map((row) => row.id), ...cmeTimelineSnapshots.map((row) => row.id)])
  );
  let topActives: Array<{
    snapshot_id: string;
    rank: number;
    strike: number;
    put: number;
    call: number;
    total: number;
  }> = [];

  if (snapshotIds.length > 0) {
    const { data } = await adminDb
      .from("cme_top_actives")
      .select("snapshot_id,rank,strike,put,call,total,vol_settle")
      .in("snapshot_id", snapshotIds)
      .order("rank", { ascending: true });

    topActives = data || [];
  }

  const deltaIds = (cmeDeltaRes.data || []).map((row) => row.id);
  let topStrikeChanges: Array<Record<string, any>> = [];
  if (deltaIds.length > 0) {
    const { data } = await adminDb
      .from("cme_top_strike_changes")
      .select("*")
      .in("delta_id", deltaIds)
      .order("rank", { ascending: true });
    topStrikeChanges = data || [];
  }

  const pricesBySymbol = new Map<string, { price: number; event_time_utc: string; event_time_bkk: string }>();
  const secondPriceBySymbol = new Map<string, { price: number; event_time_utc: string; event_time_bkk: string }>();
  for (const row of pricesRes.data || []) {
    if (!pricesBySymbol.has(row.symbol)) {
      pricesBySymbol.set(row.symbol, row);
    } else if (!secondPriceBySymbol.has(row.symbol)) {
      secondPriceBySymbol.set(row.symbol, row);
    }
  }

  function pct(now: number | null, prev: number | null): number | null {
    if (now == null || prev == null || prev === 0) return null;
    return ((now - prev) / prev) * 100;
  }

  return NextResponse.json({
    prices: Array.from(pricesBySymbol.entries()).map(([symbol, item]) => {
      const prev = secondPriceBySymbol.get(symbol) || null;
      const minuteAbsChange =
        prev && typeof item.price === "number" && typeof prev.price === "number"
          ? item.price - prev.price
          : null;
      return {
        symbol,
        ...item,
        previous_price: prev?.price ?? null,
        previous_event_time_bkk: prev?.event_time_bkk ?? null,
        minute_abs_change: minuteAbsChange,
        minute_pct_change: pct(item.price ?? null, prev?.price ?? null)
      };
    }),
    relation: null,
    cme_snapshots: cmeRes.data || [],
    cme_timeline_snapshots: cmeTimelineSnapshots,
    top_actives: topActives,
    cme_deltas: cmeDeltaRes.data || [],
    cme_top_strike_changes: topStrikeChanges,
    market_status: getDashboardMarketStatus(anchor)
  });
}
