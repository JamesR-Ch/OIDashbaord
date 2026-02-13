export type StatusTone = "up" | "down" | "neutral";
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface OverviewPriceVM {
  symbol: string;
  price: number;
  event_time_bkk: string;
  minute_abs_change?: number | null;
  minute_pct_change?: number | null;
}

export interface OverviewCmeRatioVM {
  view_type: "intraday" | "oi";
  series_name: string;
  put_total: number;
  call_total: number;
  snapshot_time_bkk: string;
  series_expiration_date?: string | null;
  series_dte?: number | null;
}

export interface OverviewRelationHeatmapVM {
  symbols: string[];
  matrix: Record<string, number | null>;
}

export interface OverviewTopChangeVM {
  delta_id: string;
  view_type: string;
  series_name: string;
  snapshot_time_bkk: string;
  previous_snapshot_time_bkk?: string | null;
}

export interface OverviewViewModel {
  prices: OverviewPriceVM[];
  relation: any | null;
  cmeSnapshots: OverviewCmeRatioVM[];
  cmeDeltas: any[];
  cmeTopStrikeChanges: any[];
  topActives: any[];
  jobs: any[];
}

export interface CmeSnapshotVM {
  id: string;
  view_type: "intraday" | "oi";
  snapshot_time_bkk: string;
  series_name: string;
  series_expiration_date?: string | null;
  series_dte?: number | null;
  put_total: number;
  call_total: number;
  vol?: number | null;
  vol_chg?: number | null;
  future_chg?: number | null;
}

export interface CmeViewModel {
  snapshots: CmeSnapshotVM[];
  topActives: any[];
  deltas: any[];
  topStrikeChanges: any[];
}

export interface RelationSignalVM {
  pair: string;
  correlation: number | null;
  beta: number | null;
  spread: number | null;
  z_score: number | null;
  relative_strength: number | null;
}

export interface RelationsViewModel {
  relation: any | null;
}

export function toOverviewViewModel(raw: any): OverviewViewModel {
  return {
    prices: raw?.prices || [],
    relation: raw?.relation || null,
    cmeSnapshots: raw?.cme_snapshots || [],
    cmeDeltas: raw?.cme_deltas || [],
    cmeTopStrikeChanges: raw?.cme_top_strike_changes || [],
    topActives: raw?.top_actives || [],
    jobs: raw?.jobs || []
  };
}

export function toCmeViewModel(raw: any): CmeViewModel {
  return {
    snapshots: raw?.cme_snapshots || [],
    topActives: raw?.top_actives || [],
    deltas: raw?.cme_deltas || [],
    topStrikeChanges: raw?.cme_top_strike_changes || []
  };
}

export function toRelationsViewModel(raw: any): RelationsViewModel {
  return {
    relation: raw?.relation || null
  };
}
