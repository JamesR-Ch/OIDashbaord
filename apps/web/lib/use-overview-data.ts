"use client";

import { useEffect, useState } from "react";

const DEFAULT_REFRESH_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MS || "15000");
const DEFAULT_HIDDEN_REFRESH_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_HIDDEN_MS || "60000");
const DEFAULT_MAX_BACKOFF_MS = Number(process.env.NEXT_PUBLIC_DASHBOARD_POLL_MAX_BACKOFF_MS || "120000");

function normalizeMs(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
    let retryDelayMs = normalizeMs(refreshMs, 15000);
    let hadError = false;

    const baseRefreshMs = normalizeMs(refreshMs, 15000);
    const hiddenRefresh = normalizeMs(hiddenRefreshMs, Math.max(baseRefreshMs, 60000));
    const maxBackoffMs = normalizeMs(DEFAULT_MAX_BACKOFF_MS, 120000);

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
        const res = await fetch("/api/dashboard/overview-public", {
          cache: "no-store",
          signal: requestAbort.signal
        });
        if (!res.ok) {
          throw new Error(`overview fetch failed: ${res.status}`);
        }
        const json = await res.json();
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
