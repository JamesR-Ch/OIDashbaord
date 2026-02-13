"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "../../components/nav";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import { clearServerSession, signInWithGithub, signInWithPassword, signOut, syncServerSession } from "../../lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [nextPath, setNextPath] = useState("/settings");
  const syncingRef = useRef(false);
  const lastSyncedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawNextPath = params.get("next") || "/settings";
    setNextPath(rawNextPath.startsWith("/") ? rawNextPath : "/settings");
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    async function syncThenRedirect(accessToken: string) {
      if (!accessToken) return;
      if (syncingRef.current) return;
      if (lastSyncedTokenRef.current === accessToken) return;

      syncingRef.current = true;
      const ok = await syncServerSession(accessToken);
      syncingRef.current = false;

      if (!ok) {
        setMessage("Session sync failed (likely rate-limited). Please wait a few seconds and try again.");
        return;
      }

      lastSyncedTokenRef.current = accessToken;
      router.replace(nextPath as any);
    }

    // Handle OAuth return and existing sessions.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        void syncThenRedirect(data.session.access_token);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.access_token) {
        void syncThenRedirect(session.access_token);
      } else if (event === "SIGNED_OUT") {
        lastSyncedTokenRef.current = null;
        void clearServerSession();
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [nextPath, router]);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Signing in...");
    const { error } = await signInWithPassword(email, password);

    if (error) {
      setMessage(`Sign-in failed: ${error.message}`);
      return;
    }

    const supabase = getBrowserSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      const ok = await syncServerSession(data.session.access_token);
      if (!ok) {
        setMessage("Sign-in succeeded, but session sync is rate-limited. Please wait a few seconds and retry.");
        return;
      }
      lastSyncedTokenRef.current = data.session.access_token;
      router.replace(nextPath as any);
      return;
    }

    setMessage("Signed in successfully.");
    setPassword("");
  }

  async function onSignOut() {
    const { error } = await signOut();
    await clearServerSession();
    if (error) {
      setMessage(`Sign-out failed: ${error.message}`);
      return;
    }
    setMessage("Signed out.");
  }

  async function onGithubSignIn() {
    setMessage("Redirecting to GitHub...");
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await signInWithGithub(redirectTo);
    if (error) {
      setMessage(`GitHub sign-in failed: ${error.message}`);
    }
  }

  return (
    <main className="container">
      <TopNav />
      <section className="card" style={{ maxWidth: 560 }}>
        <h2>Login</h2>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Sign in with Supabase. Session token is handled automatically and used for protected settings APIs.
        </p>
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={onGithubSignIn}>Sign In with GitHub</button>
        </div>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>or use email/password</p>
        <form onSubmit={onSignIn} style={{ marginTop: 12 }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <label htmlFor="password" style={{ marginTop: 8, display: "block" }}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit">Sign In</button>
            <button type="button" onClick={onSignOut}>Sign Out</button>
          </div>
          <p style={{ marginTop: 10, color: "var(--muted)" }}>{message}</p>
        </form>
      </section>
    </main>
  );
}
