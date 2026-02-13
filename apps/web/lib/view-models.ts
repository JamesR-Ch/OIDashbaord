export type StatusTone = "ok" | "warn" | "neutral";

export interface OverviewViewModel {
  prices: any[];
  relation: any | null;
  cmeSnapshots: any[];
  cmeDeltas: any[];
  cmeTopStrikeChanges: any[];
  jobs: any[];
}

export interface CmeViewModel {
  snapshots: any[];
  topActives: any[];
  deltas: any[];
  topStrikeChanges: any[];
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
