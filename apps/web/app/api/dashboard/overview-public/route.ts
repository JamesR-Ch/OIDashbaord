import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/db";
import { DateTime } from "luxon";
import { getDashboardMarketStatus } from "../../../../lib/market-status";

export async function GET(req: NextRequest) {
  const adminDb = getAdminDb();
  const at = req.nextUrl.searchParams.get("at");
  const anchor = at
    ? DateTime.fromISO(at, { zone: "utc" })
    : DateTime.now().toUTC();

  const [pricesRes, relationRes, cmeRes, cmeDeltaRes] = await Promise.all([
    adminDb
      .from("price_ticks")
      .select("symbol,price,event_time_utc,event_time_bkk")
      .lte("event_time_utc", anchor.toISO())
      .order("event_time_utc", { ascending: false })
      .limit(120),
    adminDb
      .from("relation_snapshots_30m")
      .select("*")
      .lte("anchor_time_utc", anchor.toISO())
      .order("anchor_time_utc", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminDb
      .from("cme_snapshots")
      .select("*")
      .order("snapshot_time_utc", { ascending: false })
      .limit(2),
    adminDb
      .from("cme_snapshot_deltas")
      .select("*")
      .order("snapshot_time_utc", { ascending: false })
      .limit(4)
  ]);

  const snapshotIds = (cmeRes.data || []).map((row) => row.id);
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
    relation: relationRes.data,
    cme_snapshots: cmeRes.data || [],
    top_actives: topActives,
    cme_deltas: cmeDeltaRes.data || [],
    cme_top_strike_changes: topStrikeChanges,
    market_status: getDashboardMarketStatus(anchor)
  });
}
