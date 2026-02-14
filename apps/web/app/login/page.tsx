"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import {
  clearServerSession,
  getSessionSyncRetryInMs,
  hasRecentlySyncedToken,
  noteSessionSyncSuccess,
  shouldCooldownSessionSync,
  signInWithGithub,
  signInWithPassword,
  signOut,
  syncServerSession
} from "../../lib/auth-client";

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
      if (!accessToken || syncingRef.current || lastSyncedTokenRef.current === accessToken) return;
      if (hasRecentlySyncedToken(accessToken)) {
        lastSyncedTokenRef.current = accessToken;
        router.replace(nextPath as any);
        return;
      }
      if (shouldCooldownSessionSync()) {
        const retryInSec = Math.ceil(getSessionSyncRetryInMs() / 1000);
        setMessage(`Session sync cooling down. Try again in ~${retryInSec}s.`);
        return;
      }

      syncingRef.current = true;
      const ok = await syncServerSession(accessToken);
      syncingRef.current = false;

      if (!ok) {
        setMessage("Session sync failed (likely rate-limited). Please wait a few seconds and try again.");
        return;
      }

      noteSessionSyncSuccess(accessToken);
      lastSyncedTokenRef.current = accessToken;
      router.replace(nextPath as any);
    }

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
      if (shouldCooldownSessionSync()) {
        const retryInSec = Math.ceil(getSessionSyncRetryInMs() / 1000);
        setMessage(`Sign-in succeeded, sync cooling down. Retry in ~${retryInSec}s.`);
        return;
      }
      const ok = await syncServerSession(data.session.access_token);
      if (!ok) {
        setMessage("Sign-in succeeded, but session sync is rate-limited. Please wait a few seconds and retry.");
        return;
      }
      noteSessionSyncSuccess(data.session.access_token);
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
    <AppShell>
      <PageHeader title="Login" subtitle="Authenticate with Supabase to access admin settings." />
      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Use GitHub OAuth or email/password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" className="w-full" onClick={onGithubSignIn}>Sign In with GitHub</Button>

          <form onSubmit={onSignIn} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Sign In</Button>
              <Button type="button" variant="ghost" onClick={onSignOut}>Sign Out</Button>
            </div>
          </form>

          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
