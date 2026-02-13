"use client";

import { useEffect, useState } from "react";

export function useOverviewData(refreshMs = 15000) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/overview-public", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`overview fetch failed: ${res.status}`);
        }
        const json = await res.json();
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (active) {
          setError(e?.message || "failed to load overview");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, refreshMs);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshMs]);

  return { data, loading, error };
}
