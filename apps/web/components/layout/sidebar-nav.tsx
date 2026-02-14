"use client";

import Image from "next/image";
import Link from "next/link";
import { BarChart3, CandlestickChart, Cpu, Gauge, LogOut, Settings, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const links = [
  { label: "Overview", href: "/overview", icon: Gauge },
  { label: "CME", href: "/cme", icon: CandlestickChart },
  { label: "Relations", href: "/relations", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings }
] as const;

interface SidebarNavProps {
  pathname: string;
  isLoggedIn: boolean;
  loggingOut: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onLogout: () => void;
}

export function SidebarNav({
  pathname,
  isLoggedIn,
  loggingOut,
  mobile = false,
  onClose,
  onLogout
}: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/overview" className="flex items-center gap-3 rounded-lg border border-border bg-elevated px-3 py-3">
          <Image src="/logo.png" alt="OIDashboard logo" width={32} height={32} className="rounded-md object-cover" />
          <div>
            <p className="text-sm font-semibold">OIDashboard</p>
            <p className="text-[11px] text-muted-foreground">Decision Terminal</p>
          </div>
        </Link>
        {mobile ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 px-0">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mb-3 section-title">Navigation</div>
      <nav className="space-y-1.5" aria-label="Primary">
        {links.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-all duration-150",
                active
                  ? "border-primary/45 bg-primary/15 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:bg-elevated hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-lg border border-border bg-elevated p-3 text-xs">
        <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <Cpu className="h-3.5 w-3.5 text-primary" /> Quick System
        </p>
        <p className="text-muted-foreground">Connected to live webhook and worker pipeline.</p>
      </div>

      <div className="mt-auto pt-4">
        {isLoggedIn ? (
          <Button type="button" variant="ghost" className="w-full justify-start gap-2" onClick={onLogout} disabled={loggingOut}>
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Logging out..." : "Logout"}
          </Button>
        ) : (
          <p className="px-2 text-xs text-muted-foreground">Public mode</p>
        )}
      </div>
    </div>
  );
}
