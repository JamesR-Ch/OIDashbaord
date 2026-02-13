import type { SymbolCode } from "./types";

export interface PairComputation {
  correlation: number | null;
  beta: number | null;
  spread: number | null;
  zScore: number | null;
  relativeStrength: number | null;
}

export function safePctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function safeAbsChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

export function olsBeta(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;

  let cov = 0;
  let varX = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    cov += dx * (ys[i] - meanY);
    varX += dx * dx;
  }

  if (varX === 0) return null;
  return cov / varX;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function std(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m === null) return null;
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function zScore(current: number, window: number[]): number | null {
  const m = mean(window);
  const s = std(window);
  if (m === null || s === null || s === 0) return null;
  return (current - m) / s;
}

export function computeRelativeStrength(pctA: number | null, pctB: number | null, beta: number | null, spreadZ: number | null): number | null {
  if (pctA === null || pctB === null) return null;
  const betaAdj = beta === null ? 0 : beta;
  const zAdj = spreadZ === null ? 0 : spreadZ;
  return 0.6 * (pctA - pctB) + 0.25 * betaAdj - 0.15 * zAdj;
}

export function makePairId(a: SymbolCode, b: SymbolCode): `${SymbolCode}_${SymbolCode}` {
  return `${a}_${b}`;
}
