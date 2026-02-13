"use client";

import Link from "next/link";

const links = [
  ["Overview", "/overview"],
  ["CME", "/cme"],
  ["Relations", "/relations"],
  ["Settings", "/settings"]
] as const;

export function TopNav() {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Primary">
      {links.map(([label, href]) => (
        <Link key={href} href={href} className="rounded-md border border-border bg-panel/70 px-3 py-1.5 text-xs text-muted-foreground">
          {label}
        </Link>
      ))}
    </nav>
  );
}
