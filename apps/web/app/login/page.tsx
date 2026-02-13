"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "../../components/nav";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import { clearServerSession, signInWithGithub, signInWithPassword, signOut, syncServerSession } from "../../lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();

    // Handle OAuth return and existing sessions.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        void syncServerSession(data.session.access_token);
        router.replace("/settings");
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) {
        void syncServerSession(session.access_token);
        router.replace("/settings");
      } else if (event === "SIGNED_OUT") {
        void clearServerSession();
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [router]);

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
      await syncServerSession(data.session.access_token);
    }

    setMessage("Signed in successfully. You can now open /settings.");
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
