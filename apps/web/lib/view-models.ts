export type StatusTone = "up" | "down" | "neutral";
export type HeatLevel = 0 | 1 | 2 | 3 | 4;
export type SignalStrength = "weak" | "moderate" | "strong";
export type StaleState = "fresh" | "stale" | "unknown";

export interface OverviewPriceVM {
  symbol: string;
  price: number | null;
  previous_price: number | null;
  event_time_bkk: string | null;
  previous_event_time_bkk: string | null;
  minute_abs_change: number | null;
  minute_pct_change: number | null;
}

export interface RelationSymbolReturnVM {
  symbol: string;
  degraded: boolean;
  abs_change: number | null;
  pct_change: number | null;
  current_price: number | null;
  previous_price: number | null;
  points_observed: number | null;
  minute_abs_change: number | null;
  minute_pct_change: number | null;
}

export interface RelationPairMetricVM {
  pair: string;
  correlation: number | null;
  beta: number | null;
  spread: number | null;
  z_score: number | null;
  relative_strength: number | null;
  aligned_points: number | null;
  minute_return_diff: number | null;
  minute_direction_agree: boolean | null;
}

export interface RelationQualityFlagsVM {
  open_symbols: string[];
  closed_symbols: string[];
  degraded_symbols: string[];
  min_points_required: number | null;
  pair_aligned_points: string[];
}

export interface RelationSnapshotVM {
  id: string;
  anchor_time_utc: string;
  anchor_time_bkk: string;
  window_start_utc: string;
  window_end_utc: string;
  window_start_bkk: string;
  window_end_bkk: string;
  symbol_returns: RelationSymbolReturnVM[];
  pair_metrics: RelationPairMetricVM[];
  quality_flags: RelationQualityFlagsVM;
  created_at: string;
}

export interface CmeSnapshotVM {
  id: string;
  view_type: "intraday" | "oi";
  snapshot_time_utc: string;
  snapshot_time_bkk: string;
  trade_date_bkk: string;
  series_name: string;
  series_expiration_label: string | null;
  series_expiration_date: string | null;
  series_dte: number | null;
  put_total: number;
  call_total: number;
  vol: number | null;
  vol_chg: number | null;
  future_chg: number | null;
  xauusd_price_at_snapshot: number | null;
  source_url: string | null;
  created_at: string;
}

export interface CmeTopActiveVM {
  snapshot_id: string;
  rank: number;
  strike: number;
  put: number;
  call: number;
  total: number;
  vol_settle: number | null;
}

export interface CmeDeltaVM {
  id: string;
  current_snapshot_id: string;
  previous_snapshot_id: string;
  view_type: "intraday" | "oi";
  snapshot_time_utc: string;
  snapshot_time_bkk: string;
  previous_snapshot_time_utc: string | null;
  previous_snapshot_time_bkk: string | null;
  series_name: string;
  put_before: number;
  put_now: number;
  put_change: number;
  call_before: number;
  call_now: number;
  call_change: number;
  vol_before: number | null;
  vol_now: number | null;
  vol_change: number | null;
  future_before: number | null;
  future_now: number | null;
  future_change: number | null;
  created_at: string;
}

export interface CmeTopStrikeChangeVM {
  id: string;
  delta_id: string;
  rank: number;
  strike: number;
  put_before: number;
  put_now: number;
  put_change: number;
  call_before: number;
  call_now: number;
  call_change: number;
  total_before: number;
  total_now: number;
  total_change: number;
  created_at: string;
}

export interface OverviewViewModel {
  prices: OverviewPriceVM[];
  relation: RelationSnapshotVM | null;
  cmeSnapshots: CmeSnapshotVM[];
  cmeDeltas: CmeDeltaVM[];
  cmeTopStrikeChanges: CmeTopStrikeChangeVM[];
  topActives: CmeTopActiveVM[];
}

export interface CmeViewModel {
  snapshots: CmeSnapshotVM[];
  topActives: CmeTopActiveVM[];
  deltas: CmeDeltaVM[];
  topStrikeChanges: CmeTopStrikeChangeVM[];
}

export interface RelationsViewModel {
  relation: RelationSnapshotVM | null;
}

export function toneFromNumber(value: number | null | undefined): StatusTone {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "up" : "down";
}

export function heatLevelFromValue(value: number | null | undefined): HeatLevel {
  const v = typeof value === "number" && Number.isFinite(value) ? Math.abs(value) : 0;
  if (v >= 0.8) return 4;
  if (v >= 0.5) return 3;
  if (v >= 0.25) return 2;
  if (v >= 0.1) return 1;
  return 0;
}

export function strengthFromAbsCorrelation(absCorr: number | null | undefined): SignalStrength {
  if (typeof absCorr !== "number" || !Number.isFinite(absCorr)) return "weak";
  if (absCorr >= 0.7) return "strong";
  if (absCorr >= 0.4) return "moderate";
  return "weak";
}

export function staleStateFromAge(ageMin: number | null | undefined, staleAfterMin = 10): StaleState {
  if (typeof ageMin !== "number" || !Number.isFinite(ageMin)) return "unknown";
  return ageMin > staleAfterMin ? "stale" : "fresh";
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function toOverviewViewModel(raw: any): OverviewViewModel {
  return {
    prices: asArray<OverviewPriceVM>(raw?.prices),
    relation: (raw?.relation as RelationSnapshotVM | null) || null,
    cmeSnapshots: asArray<CmeSnapshotVM>(raw?.cme_snapshots),
    cmeDeltas: asArray<CmeDeltaVM>(raw?.cme_deltas),
    cmeTopStrikeChanges: asArray<CmeTopStrikeChangeVM>(raw?.cme_top_strike_changes),
    topActives: asArray<CmeTopActiveVM>(raw?.top_actives)
  };
}

export function toCmeViewModel(raw: any): CmeViewModel {
  return {
    snapshots: asArray<CmeSnapshotVM>(raw?.cme_snapshots),
    topActives: asArray<CmeTopActiveVM>(raw?.top_actives),
    deltas: asArray<CmeDeltaVM>(raw?.cme_deltas),
    topStrikeChanges: asArray<CmeTopStrikeChangeVM>(raw?.cme_top_strike_changes)
  };
}

export function toRelationsViewModel(raw: any): RelationsViewModel {
  return {
    relation: (raw?.relation as RelationSnapshotVM | null) || null
  };
}
