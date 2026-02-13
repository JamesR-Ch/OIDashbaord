import { DateTime } from "luxon";
import { SYMBOLS, computeRelativeStrength, makePairId, olsBeta, pearsonCorrelation, safeAbsChange, safePctChange, zScore, type RelationSnapshot } from "@oid/shared";
import { db } from "../lib/db";
import { logger } from "../services/logger";
import { isSymbolMarketOpen } from "../services/cme-gates";

const BKK_ZONE = "Asia/Bangkok";
const MIN_POINTS = 24;

function minuteKey(iso: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).startOf("minute").toISO() || iso;
}

export async function runRelationJob(anchorTimeBkk = DateTime.now().setZone(BKK_ZONE)) {
  const startedMs = Date.now();
  const startedAt = DateTime.utc();
  const started = startedAt.toISO();

  try {
    const anchorUtc = anchorTimeBkk.toUTC().startOf("minute");
    const symbolSessions = SYMBOLS.map((symbol) => ({ symbol, state: isSymbolMarketOpen(symbol, anchorUtc) }));
    const openSymbols = symbolSessions.filter((x) => x.state.open).map((x) => x.symbol);
    const closedSymbols = symbolSessions.filter((x) => !x.state.open).map((x) => x.symbol);

    if (openSymbols.length < 2) {
      const finishedAt = DateTime.utc();
      await db.from("job_runs").insert({
        job_name: "relation_30m",
        status: "skipped",
        started_at: started,
        finished_at: finishedAt.toISO(),
        metadata: {
          reason: "relation_market_closed_or_insufficient_open_symbols",
          open_symbols: openSymbols,
          closed_symbols: closedSymbols,
          sessions: symbolSessions,
          duration_ms: Math.max(0, Date.now() - startedMs)
        }
      });
      return;
    }

    const windowStartUtc = anchorUtc.minus({ minutes: 30 });
    const currentMinuteKey = anchorUtc.startOf("minute").toISO();
    const previousMinuteKey = anchorUtc.minus({ minutes: 1 }).startOf("minute").toISO();

    const { data: ticks, error: tickError } = await db
      .from("price_ticks")
      .select("symbol,price,event_time_utc")
      .gte("event_time_utc", windowStartUtc.toISO())
      .lte("event_time_utc", anchorUtc.toISO())
      .order("event_time_utc", { ascending: true });

    if (tickError) throw tickError;

    const bySymbolMinute = new Map<string, Map<string, number>>();
    for (const symbol of SYMBOLS) bySymbolMinute.set(symbol, new Map());

    for (const t of ticks || []) {
      const key = minuteKey(t.event_time_utc);
      bySymbolMinute.get(t.symbol)?.set(key, t.price);
    }

    const bySymbol = new Map<string, Array<{ price: number; ts: string }>>();
    for (const symbol of SYMBOLS) {
      const minuteMap = bySymbolMinute.get(symbol) || new Map();
      const rows = Array.from(minuteMap.entries())
        .map(([ts, price]) => ({ ts, price }))
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      bySymbol.set(symbol, rows);
    }

    const returnsBySymbol = new Map<string, Map<string, number>>();
    for (const symbol of SYMBOLS) {
      const rows = bySymbol.get(symbol) || [];
      const retMap = new Map<string, number>();
      for (let i = 1; i < rows.length; i += 1) {
        const prev = rows[i - 1].price;
        const cur = rows[i].price;
        if (prev !== 0) {
          retMap.set(rows[i].ts, (cur - prev) / prev);
        }
      }
      returnsBySymbol.set(symbol, retMap);
    }

    const symbolReturns = SYMBOLS.map((symbol) => {
      const isOpen = openSymbols.includes(symbol);
      const rows = bySymbol.get(symbol) || [];
      const current = isOpen && rows.length ? rows[rows.length - 1].price : null;
      const previous = isOpen && rows.length ? rows[0].price : null;
      const minuteCurrent =
        isOpen && currentMinuteKey ? bySymbolMinute.get(symbol)?.get(currentMinuteKey) ?? null : null;
      const minutePrevious =
        isOpen && previousMinuteKey ? bySymbolMinute.get(symbol)?.get(previousMinuteKey) ?? null : null;
      return {
        symbol,
        current_price: current,
        previous_price: previous,
        abs_change: safeAbsChange(current, previous),
        pct_change: safePctChange(current, previous),
        minute_current_price: minuteCurrent,
        minute_previous_price: minutePrevious,
        minute_abs_change: safeAbsChange(minuteCurrent, minutePrevious),
        minute_pct_change: safePctChange(minuteCurrent, minutePrevious),
        points_observed: isOpen ? rows.length : 0,
        degraded: isOpen ? rows.length < MIN_POINTS : true
      };
    });

    const pairDefs: Array<[typeof SYMBOLS[number], typeof SYMBOLS[number]]> = [
      ["XAUUSD", "THBUSD"],
      ["XAUUSD", "BTCUSD"],
      ["THBUSD", "BTCUSD"]
    ];

    const pairMetrics = pairDefs.map(([a, b]) => {
      const aOpen = openSymbols.includes(a);
      const bOpen = openSymbols.includes(b);
      if (!aOpen || !bOpen) {
        return {
          pair: makePairId(a, b),
          correlation: null,
          beta: null,
          spread: null,
          z_score: null,
          relative_strength: null,
          minute_return_diff: null,
          minute_direction_agree: null,
          aligned_points: 0
        };
      }

      const aRows = bySymbol.get(a) || [];
      const bRows = bySymbol.get(b) || [];
      const aReturnsMap = returnsBySymbol.get(a) || new Map();
      const bReturnsMap = returnsBySymbol.get(b) || new Map();
      const alignedTs = Array.from(aReturnsMap.keys()).filter((ts) => bReturnsMap.has(ts));
      alignedTs.sort((x, y) => new Date(x).getTime() - new Date(y).getTime());
      const aReturns = alignedTs.map((ts) => aReturnsMap.get(ts) as number);
      const bReturns = alignedTs.map((ts) => bReturnsMap.get(ts) as number);

      const correlation = pearsonCorrelation(aReturns, bReturns);
      const beta = olsBeta(aReturns, bReturns);

      const rowA = symbolReturns.find((x) => x.symbol === a);
      const rowB = symbolReturns.find((x) => x.symbol === b);
      const minuteReturnDiff =
        rowA?.minute_pct_change !== null && rowA?.minute_pct_change !== undefined &&
        rowB?.minute_pct_change !== null && rowB?.minute_pct_change !== undefined
          ? rowA.minute_pct_change - rowB.minute_pct_change
          : null;
      const minuteDirectionAgree =
        rowA?.minute_pct_change !== null && rowA?.minute_pct_change !== undefined &&
        rowB?.minute_pct_change !== null && rowB?.minute_pct_change !== undefined
          ? Math.sign(rowA.minute_pct_change) === Math.sign(rowB.minute_pct_change)
          : null;
      const spread =
        rowA?.pct_change !== null && rowA?.pct_change !== undefined &&
        rowB?.pct_change !== null && rowB?.pct_change !== undefined
          ? rowA.pct_change - rowB.pct_change
          : null;

      const historicalSpreads: number[] = [];
      for (let i = 0; i < Math.min(aReturns.length, bReturns.length); i += 1) {
        historicalSpreads.push((aReturns[i] - bReturns[i]) * 100);
      }

      const currentSpread = spread ?? 0;
      const z = historicalSpreads.length > 2 ? zScore(currentSpread, historicalSpreads) : null;

      return {
        pair: makePairId(a, b),
        correlation,
        beta,
        spread,
        z_score: z,
        relative_strength: computeRelativeStrength(rowA?.pct_change ?? null, rowB?.pct_change ?? null, beta, z),
        minute_return_diff: minuteReturnDiff,
        minute_direction_agree: minuteDirectionAgree,
        aligned_points: alignedTs.length
      };
    });

    const snapshot: RelationSnapshot = {
      anchor_time_bkk: anchorTimeBkk.toISO() || anchorTimeBkk.toString(),
      window_start_bkk: windowStartUtc.setZone(BKK_ZONE).toISO() || windowStartUtc.toISO() || "",
      window_end_bkk: anchorUtc.setZone(BKK_ZONE).toISO() || anchorUtc.toISO() || "",
      symbol_returns: symbolReturns,
      pair_metrics: pairMetrics,
      quality_flags: {
        min_points_required: MIN_POINTS,
        open_symbols: openSymbols,
        closed_symbols: closedSymbols,
        degraded_symbols: symbolReturns.filter((x) => x.degraded).map((x) => x.symbol),
        pair_aligned_points: pairMetrics.map((p: any) => `${p.pair}:${p.aligned_points ?? 0}`)
      }
    };

    const { error: saveError } = await db
      .from("relation_snapshots_30m")
      .upsert(
        {
          anchor_time_utc: anchorUtc.toISO(),
          anchor_time_bkk: snapshot.anchor_time_bkk,
          window_start_utc: windowStartUtc.toISO(),
          window_end_utc: anchorUtc.toISO(),
          window_start_bkk: snapshot.window_start_bkk,
          window_end_bkk: snapshot.window_end_bkk,
          symbol_returns: snapshot.symbol_returns,
          pair_metrics: snapshot.pair_metrics,
          quality_flags: snapshot.quality_flags
        },
        { onConflict: "anchor_time_utc" }
      );

    if (saveError) throw saveError;

    const finishedAt = DateTime.utc();
    await db.from("job_runs").insert({
      job_name: "relation_30m",
      status: "success",
      started_at: started,
      finished_at: finishedAt.toISO(),
      metadata: {
        anchor_time_bkk: snapshot.anchor_time_bkk,
        points: (ticks || []).length,
        degraded_symbols: snapshot.quality_flags.degraded_symbols,
        pair_aligned_points: snapshot.quality_flags.pair_aligned_points,
        duration_ms: Math.max(0, Date.now() - startedMs)
      }
    });
  } catch (error: any) {
    logger.error({ err: error }, "relation job failed");
    const finishedAt = DateTime.utc();
    await db.from("job_runs").insert({
      job_name: "relation_30m",
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
