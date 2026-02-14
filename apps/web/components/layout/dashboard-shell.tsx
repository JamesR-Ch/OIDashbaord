"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CandlestickChart, Cpu, Gauge, Settings } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

const links = [
  { label: "Overview", href: "/overview", icon: Gauge },
  { label: "CME", href: "/cme", icon: CandlestickChart },
  { label: "Relations", href: "/relations", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings }
] as const;

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
  const [now, setNow] = useState<{ utc: string; bkk: string } | null>(null);

  useEffect(() => {
    setNow(nowText());
    const timer = setInterval(() => setNow(nowText()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 md:grid-cols-[270px_1fr]">
        <aside className="border-b border-border bg-panel p-4 md:border-b-0 md:border-r md:p-6">
          <Link href="/overview" className="mb-7 flex items-center gap-3 rounded-lg border border-border bg-elevated px-3 py-3.5">
            <Image src="/logo.png" alt="OIDashboard logo" width={34} height={34} className="rounded-md object-cover" />
            <div>
              <p className="text-sm font-semibold">OIDashboard</p>
              <p className="text-[11px] text-muted-foreground">Decision Terminal</p>
            </div>
          </Link>

          <div className="mb-3 section-title">Navigation</div>
          <nav className="space-y-1.5" aria-label="Primary">
            {links.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-all duration-200",
                    active
                      ? "border-primary/50 bg-primary/15 text-foreground shadow-glow"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-elevated hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-7 rounded-lg border border-border bg-elevated p-3.5 text-xs">
            <p className="mb-1 flex items-center gap-2 font-medium text-foreground"><Cpu className="h-3.5 w-3.5 text-primary" /> Quick System</p>
            <p className="text-muted-foreground">Connected to live webhook + worker pipeline.</p>
          </div>
        </aside>

        <div className="p-4 md:p-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-panel px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">Connected</span>
              <Badge variant="outline" className="ml-2">{now?.utc || "UTC --:--:--"}</Badge>
              <Badge variant="outline">{now?.bkk || "BKK --:--:--"}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">Relation age: {status?.relationAgeMin == null ? "-" : `${status.relationAgeMin}m`}</Badge>
              <Badge variant="outline">CME age: {status?.cmeAgeMin == null ? "-" : `${status.cmeAgeMin}m`}</Badge>
            </div>
          </header>

          {children}
        </div>
      </div>
    </main>
  );
}
