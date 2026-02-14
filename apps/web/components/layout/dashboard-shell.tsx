"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearServerSession, signOut } from "../../lib/auth-client";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";
import { SidebarNav } from "./sidebar-nav";
import { TopRail } from "./top-rail";

interface DashboardShellProps {
  children: React.ReactNode;
  status?: {
    relationAgeMin?: number | null;
    cmeAgeMin?: number | null;
  };
}

function nowText() {
  const d = new Date();
  return {
    utc: d.toISOString().replace("T", " ").slice(0, 19) + " UTC",
    bkk: d.toLocaleString("en-US", { timeZone: "Asia/Bangkok", hour12: false }) + " GMT+7"
  };
}

export function DashboardShell({ children, status }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [now, setNow] = useState<{ utc: string; bkk: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setNow(nowText());
    const timer = setInterval(() => setNow(nowText()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsLoggedIn(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setIsLoggedIn(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setIsLoggedIn(!!session);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function onLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await signOut();
    await clearServerSession();
    setIsLoggedIn(false);
    setLoggingOut(false);
    router.replace("/overview");
  }

  return (
    <main className="min-h-screen bg-transparent text-foreground">
      <div className="app-canvas grid min-h-screen grid-cols-1 md:grid-cols-[278px_1fr]">
        <aside className="hidden border-r border-border bg-panel p-6 md:block">
          <SidebarNav
            pathname={pathname}
            isLoggedIn={isLoggedIn}
            loggingOut={loggingOut}
            onLogout={onLogout}
          />
        </aside>

        <div className="px-3 pb-7 pt-3 md:px-6 md:pb-10 md:pt-4">
          <TopRail
            nowUtc={now?.utc || "UTC --:--:--"}
            nowBkk={now?.bkk || "BKK --:--:--"}
            relationAgeMin={status?.relationAgeMin}
            cmeAgeMin={status?.cmeAgeMin}
            isLoggedIn={isLoggedIn}
            onOpenNav={() => setMobileNavOpen(true)}
          />

          {children}
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileNavOpen(false)}>
          <aside
            className="h-full w-[286px] border-r border-border bg-panel p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarNav
              pathname={pathname}
              isLoggedIn={isLoggedIn}
              loggingOut={loggingOut}
              mobile
              onClose={() => setMobileNavOpen(false)}
              onLogout={onLogout}
            />
          </aside>
        </div>
      ) : null}
    </main>
  );
}
