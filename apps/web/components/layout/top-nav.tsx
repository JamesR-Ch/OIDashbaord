"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";

const links = [
  ["Overview", "/overview"],
  ["CME", "/cme"],
  ["Relations", "/relations"],
  ["Settings", "/settings"]
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="rounded-xl border border-border bg-card/55 p-3 backdrop-blur-md shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/overview" className="group inline-flex items-center gap-3">
          <Image src="/logo.png" alt="OIDashboard logo" width={34} height={34} className="rounded-md border border-border/70 object-cover" />
          <div>
            <p className="text-sm font-semibold tracking-wide">OIDashboard</p>
            <p className="text-xs text-muted-foreground">Gold · FX · BTC Intelligence</p>
          </div>
        </Link>
        <nav className="flex flex-wrap gap-2" aria-label="Primary">
          {links.map(([label, href]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                  active
                    ? "border-primary/70 bg-primary/25 text-foreground shadow-glow"
                    : "border-border bg-card/45 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
