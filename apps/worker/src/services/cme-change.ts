export interface StrikeSnapshot {
  strike: number;
  put: number;
  call: number;
}

export interface StrikeChange {
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
}

function toNum(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function buildTopPositiveStrikeChanges(
  previousBars: StrikeSnapshot[],
  currentBars: StrikeSnapshot[],
  limit = 3
): StrikeChange[] {
  const prevByStrike = new Map<number, { put: number; call: number }>();
  for (const row of previousBars || []) {
    prevByStrike.set(Number(row.strike), {
      put: toNum(row.put),
      call: toNum(row.call)
    });
  }

  const nowByStrike = new Map<number, { put: number; call: number }>();
  for (const row of currentBars || []) {
    nowByStrike.set(Number(row.strike), {
      put: toNum(row.put),
      call: toNum(row.call)
    });
  }

  const allStrikes = new Set<number>([
    ...Array.from(prevByStrike.keys()),
    ...Array.from(nowByStrike.keys())
  ]);

  return Array.from(allStrikes)
    .map((strike) => {
      const prev = prevByStrike.get(strike) || { put: 0, call: 0 };
      const now = nowByStrike.get(strike) || { put: 0, call: 0 };
      const putChange = now.put - prev.put;
      const callChange = now.call - prev.call;
      const totalBefore = prev.put + prev.call;
      const totalNow = now.put + now.call;
      const totalChange = totalNow - totalBefore;
      return {
        strike,
        put_before: prev.put,
        put_now: now.put,
        put_change: putChange,
        call_before: prev.call,
        call_now: now.call,
        call_change: callChange,
        total_before: totalBefore,
        total_now: totalNow,
        total_change: totalChange
      };
    })
    .filter((row) => row.total_change > 0)
    .sort((a, b) => {
      const totalDiff = b.total_change - a.total_change;
      if (totalDiff !== 0) return totalDiff;
      const callDiff = b.call_change - a.call_change;
      if (callDiff !== 0) return callDiff;
      return b.put_change - a.put_change;
    })
    .slice(0, limit);
}
