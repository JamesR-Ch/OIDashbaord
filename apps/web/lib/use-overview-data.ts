"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "./supabase-browser";
import { getDashboardMarketStatus } from "./market-status";

const DEFAULT_REFRESH_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MS || "60000");
const DEFAULT_HIDDEN_REFRESH_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_HIDDEN_MS || "180000");
const DEFAULT_MAX_BACKOFF_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MAX_BACKOFF_MS || "300000");
const ENABLE_CLIENT_PUBLIC_READS = (process.env.NEXT_PUBLIC_PUBLIC_READS_CLIENT || "true") === "true";
const PRICE_LOOKBACK_ROWS = 36;
const CME_SNAPSHOT_LOOKBACK_ROWS = 6;
const CME_DELTA_LOOKBACK_ROWS = 4;
const CME_TIMELINE_MAX_SETS = 8;

function normalizeMs(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function loadOverviewViaApi(signal?: AbortSignal) {
  const res = await fetch("/api/dashboard/overview-public", {
    cache: "no-store",
    signal
  });
  if (!res.ok) {
    throw new Error(`overview fetch failed: ${res.status}`);
  }
  return res.json();
}

async function loadOverviewViaClient() {
  const supabase = getBrowserSupabaseClient();
  const anchorIso = new Date().toISOString();

  const [pricesRes, cmeRes, cmeDeltaRes] = await Promise.all([
    supabase
      .from("price_ticks")
      .select("symbol,price,event_time_utc,event_time_bkk")
      .lte("event_time_utc", anchorIso)
      .order("event_time_utc", { ascending: false })
      .limit(PRICE_LOOKBACK_ROWS),
    supabase
      .from("cme_snapshots")
      .select("*")
      .lte("snapshot_time_utc", anchorIso)
      .order("snapshot_time_utc", { ascending: false })
      .limit(CME_SNAPSHOT_LOOKBACK_ROWS),
    supabase
      .from("cme_snapshot_deltas")
      .select("*")
      .lte("snapshot_time_utc", anchorIso)
      .order("snapshot_time_utc", { ascending: false })
      .limit(CME_DELTA_LOOKBACK_ROWS)
  ]);

  if (pricesRes.error) throw new Error(pricesRes.error.message);
  if (cmeRes.error) throw new Error(cmeRes.error.message);
  if (cmeDeltaRes.error) throw new Error(cmeDeltaRes.error.message);

  const cmeSnapshots = (cmeRes.data as any[] | null) || [];
  const cmeDeltas = (cmeDeltaRes.data as any[] | null) || [];

  const latestByView = new Map<"intraday" | "oi", any>();
  for (const row of cmeSnapshots) {
    const viewType = row?.view_type as "intraday" | "oi" | undefined;
    if ((viewType === "intraday" || viewType === "oi") && !latestByView.has(viewType)) {
      latestByView.set(viewType, row);
    }
  }

  const timelineGroups = await Promise.all(
    Array.from(latestByView.values()).map(async (latest) => {
      const timelineRes = await supabase
        .from("cme_snapshots")
        .select("*")
        .eq("view_type", latest.view_type)
        .eq("trade_date_bkk", latest.trade_date_bkk)
        .eq("series_name", latest.series_name)
        .lte("snapshot_time_utc", anchorIso)
        .order("snapshot_time_utc", { ascending: false })
        .limit(CME_TIMELINE_MAX_SETS);
      if (timelineRes.error) throw new Error(timelineRes.error.message);
      return timelineRes.data || [];
    })
  );
  const cmeTimelineSnapshots = timelineGroups.flat();

  const snapshotIds = Array.from(
    new Set([...cmeSnapshots.map((row: any) => row.id), ...cmeTimelineSnapshots.map((row: any) => row.id)])
  );
  let topActives: any[] = [];
  if (snapshotIds.length > 0) {
    const topRes = await supabase
      .from("cme_top_actives")
      .select("snapshot_id,rank,strike,put,call,total,vol_settle")
      .in("snapshot_id", snapshotIds)
      .order("rank", { ascending: true });
    if (topRes.error) throw new Error(topRes.error.message);
    topActives = topRes.data || [];
  }

  const deltaIds = cmeDeltas.map((row: any) => row.id);
  let topStrikeChanges: any[] = [];
  if (deltaIds.length > 0) {
    const changesRes = await supabase
      .from("cme_top_strike_changes")
      .select("*")
      .in("delta_id", deltaIds)
      .order("rank", { ascending: true });
    if (changesRes.error) throw new Error(changesRes.error.message);
    topStrikeChanges = changesRes.data || [];
  }

  const prices = (pricesRes.data as any[] | null) || [];
  const pricesBySymbol = new Map<string, { price: number; event_time_utc: string; event_time_bkk: string }>();
  const secondPriceBySymbol = new Map<string, { price: number; event_time_utc: string; event_time_bkk: string }>();
  for (const row of prices) {
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

  return {
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
    cme_snapshots: cmeSnapshots,
    cme_timeline_snapshots: cmeTimelineSnapshots,
    top_actives: topActives,
    cme_deltas: cmeDeltas,
    cme_top_strike_changes: topStrikeChanges,
    market_status: getDashboardMarketStatus()
  };
}

export function useOverviewData(
  refreshMs = DEFAULT_REFRESH_MS,
  hiddenRefreshMs = DEFAULT_HIDDEN_REFRESH_MS
) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let requestAbort: AbortController | null = null;
    let retryDelayMs = normalizeMs(refreshMs, DEFAULT_REFRESH_MS);
    let hadError = false;

    const baseRefreshMs = normalizeMs(refreshMs, DEFAULT_REFRESH_MS);
    const hiddenRefresh = normalizeMs(hiddenRefreshMs, Math.max(baseRefreshMs, DEFAULT_HIDDEN_REFRESH_MS));
    const maxBackoffMs = DEFAULT_MAX_BACKOFF_MS;

    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function currentIntervalMs() {
      if (typeof document !== "undefined" && document.hidden) {
        return hiddenRefresh;
      }
      return baseRefreshMs;
    }

    function scheduleNext() {
      if (!active) return;
      clearTimer();
      const delay = hadError ? Math.max(currentIntervalMs(), retryDelayMs) : currentIntervalMs();
      timer = setTimeout(() => {
        void load();
      }, delay);
    }

    async function load() {
      if (!active) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        retryDelayMs = Math.min(maxBackoffMs, Math.max(baseRefreshMs, Math.round(retryDelayMs * 1.5)));
        hadError = true;
        setError("offline");
        setLoading(false);
        scheduleNext();
        return;
      }

      requestAbort?.abort();
      requestAbort = new AbortController();

      try {
        let json: any;
        if (ENABLE_CLIENT_PUBLIC_READS) {
          try {
            json = await loadOverviewViaClient();
          } catch (clientError: any) {
            json = await loadOverviewViaApi(requestAbort.signal).catch((apiError: any) => {
              throw new Error(
                `overview load failed (client=${clientError?.message || "unknown"}, api=${apiError?.message || "unknown"})`
              );
            });
          }
        } else {
          json = await loadOverviewViaApi(requestAbort.signal);
        }
        if (active) {
          setData(json);
          setError(null);
          retryDelayMs = baseRefreshMs;
          hadError = false;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (active) {
          setError(e?.message || "failed to load overview");
          retryDelayMs = Math.min(maxBackoffMs, Math.max(baseRefreshMs, Math.round(retryDelayMs * 1.5)));
          hadError = true;
        }
      } finally {
        if (active) {
          setLoading(false);
          scheduleNext();
        }
      }
    }

    void load();

    const onVisibilityChange = () => {
      if (!active) return;
      if (typeof document !== "undefined" && !document.hidden) {
        clearTimer();
        void load();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      active = false;
      clearTimer();
      requestAbort?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [refreshMs, hiddenRefreshMs]);

  return { data, loading, error };
}
