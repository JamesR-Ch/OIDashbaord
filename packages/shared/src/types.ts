export const SYMBOLS = ["XAUUSD", "THBUSD", "BTCUSD"] as const;

export type SymbolCode = (typeof SYMBOLS)[number];

export type ViewType = "intraday" | "oi";

export type JobName = "relation_30m" | "cme_30m" | "retention_cleanup";

export type JobStatus = "success" | "failed" | "skipped";

export interface PriceTick {
  symbol: SymbolCode;
  price: number;
  event_time_utc: string;
}

export interface PairMetrics {
  pair: `${SymbolCode}_${SymbolCode}`;
  correlation: number | null;
  beta: number | null;
  spread: number | null;
  z_score: number | null;
  relative_strength: number | null;
  minute_return_diff: number | null;
  minute_direction_agree: boolean | null;
}

export interface SymbolReturn {
  symbol: SymbolCode;
  current_price: number | null;
  previous_price: number | null;
  abs_change: number | null;
  pct_change: number | null;
  minute_current_price: number | null;
  minute_previous_price: number | null;
  minute_abs_change: number | null;
  minute_pct_change: number | null;
  points_observed: number;
  degraded: boolean;
}

export interface RelationSnapshot {
  anchor_time_bkk: string;
  window_start_bkk: string;
  window_end_bkk: string;
  symbol_returns: SymbolReturn[];
  pair_metrics: PairMetrics[];
  quality_flags: Record<string, boolean | string | number | string[]>;
}

export interface CmeStrikeBar {
  strike: number;
  put: number;
  call: number;
  vol_settle: number | null;
  total_activity: number;
}

export interface TopActive {
  rank: 1 | 2 | 3;
  strike: number;
  put: number;
  call: number;
  total: number;
}
