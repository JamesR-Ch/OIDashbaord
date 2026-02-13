import { getBrowserSupabaseClient } from "./supabase-browser";

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
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearServerSession(): Promise<void> {
  try {
    await fetch("/api/auth/session", {
      method: "DELETE"
    });
  } catch {
    // best effort
  }
}
