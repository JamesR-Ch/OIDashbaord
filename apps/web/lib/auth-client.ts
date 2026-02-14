import { getBrowserSupabaseClient } from "./supabase-browser";

export interface SessionState {
  status: "ok" | "cooldown" | "idle";
  user: null;
  role: null;
  lastCheckedAt: number | null;
  cooldownUntil: number | null;
}

let lastSyncedToken: string | null = null;
let lastCheckedAt: number | null = null;
let cooldownUntil: number | null = null;
let inFlightToken: string | null = null;
let inFlightSync: Promise<boolean> | null = null;

export async function signInWithPassword(email: string, password: string) {
  const res = await fetch("/api/auth/password-signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      data: { user: null, session: null },
      error: { message: json?.error || "sign-in failed" }
    };
  }

  const session = json?.session;
  if (!session?.access_token || !session?.refresh_token) {
    return {
      data: { user: null, session: null },
      error: { message: "missing session from sign-in response" }
    };
  }

  const supabase = getBrowserSupabaseClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });

  return { data, error };
}

export async function signOut() {
  const supabase = getBrowserSupabaseClient();
  return supabase.auth.signOut();
}

export async function signInWithGithub(redirectTo: string) {
  const supabase = getBrowserSupabaseClient();
  return supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo
    }
  });
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export async function syncServerSession(accessToken: string): Promise<boolean> {
  if (!accessToken) return false;

  const now = Date.now();
  if (cooldownUntil && now < cooldownUntil) {
    return false;
  }

  // Reuse recent success for same token to avoid request bursts.
  if (lastSyncedToken === accessToken && lastCheckedAt && now - lastCheckedAt < 45_000) {
    return true;
  }

  if (inFlightSync && inFlightToken === accessToken) {
    return inFlightSync;
  }

  inFlightToken = accessToken;
  inFlightSync = (async () => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (res.status === 429) {
        const payload = await res.json().catch(() => ({}));
        const retryMs =
          typeof payload?.retry_after_ms === "number" && Number.isFinite(payload.retry_after_ms)
            ? payload.retry_after_ms
            : 8_000;
        cooldownUntil = Date.now() + Math.max(1_000, retryMs);
        return false;
      }

      if (res.ok) {
        lastSyncedToken = accessToken;
        lastCheckedAt = Date.now();
        cooldownUntil = null;
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      inFlightToken = null;
      inFlightSync = null;
    }
  })();

  return inFlightSync;
}

export function getSessionState(): SessionState {
  return {
    status: cooldownUntil && Date.now() < cooldownUntil ? "cooldown" : lastCheckedAt ? "ok" : "idle",
    user: null,
    role: null,
    lastCheckedAt,
    cooldownUntil
  };
}

function resetSessionSyncState() {
  lastSyncedToken = null;
  lastCheckedAt = null;
  cooldownUntil = null;
  inFlightToken = null;
  inFlightSync = null;
}

export function clearSessionSyncCooldown() {
  cooldownUntil = null;
}

export function noteSessionSyncSuccess(token: string) {
  lastSyncedToken = token;
  lastCheckedAt = Date.now();
  cooldownUntil = null;
}

export function shouldCooldownSessionSync() {
  return !!(cooldownUntil && Date.now() < cooldownUntil);
}

export function getSessionSyncRetryInMs() {
  if (!cooldownUntil) return 0;
  return Math.max(0, cooldownUntil - Date.now());
}

export function hasRecentlySyncedToken(token: string) {
  if (!token || token !== lastSyncedToken || !lastCheckedAt) return false;
  return Date.now() - lastCheckedAt < 45_000;
}

export function markSessionSyncAttempt() {
  lastCheckedAt = Date.now();
}

export async function clearServerSession(): Promise<void> {
  resetSessionSyncState();
  try {
    await fetch("/api/auth/session", {
      method: "DELETE"
    });
  } catch {
    // best effort
  }
}
