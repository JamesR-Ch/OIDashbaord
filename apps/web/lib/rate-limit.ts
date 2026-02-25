type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 10_000;
let nextPruneAt = 0;

function pruneBuckets(now: number) {
  if (now < nextPruneAt && buckets.size < MAX_BUCKETS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  // Guardrail against unbounded growth under abusive key churn.
  if (buckets.size > MAX_BUCKETS) {
    const entries = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toDrop = buckets.size - MAX_BUCKETS;
    for (let i = 0; i < toDrop; i += 1) {
      const item = entries[i];
      if (!item) break;
      buckets.delete(item[0]);
    }
  }

  nextPruneAt = now + 60_000;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  pruneBuckets(now);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterMs: Math.max(0, current.resetAt - now) };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, retryAfterMs: 0 };
}
