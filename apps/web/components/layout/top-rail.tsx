"use client";

import { Menu } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface TopRailProps {
  nowUtc: string;
  nowBkk: string;
  relationAgeMin?: number | null;
  cmeAgeMin?: number | null;
  isLoggedIn: boolean;
  onOpenNav: () => void;
}

export function TopRail({
  nowUtc,
  nowBkk,
  relationAgeMin,
  cmeAgeMin,
  isLoggedIn,
  onOpenNav
}: TopRailProps) {
  return (
    <header className="sticky top-2 z-20 mb-6 rounded-xl border border-border bg-panel/95 px-4 py-3 backdrop-blur-[2px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 px-0 md:hidden" onClick={onOpenNav}>
            <Menu className="h-4 w-4" />
          </Button>
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-xs text-muted-foreground">{isLoggedIn ? "Authenticated" : "Public"}</span>
          <Badge variant="outline" className="ml-2">{nowUtc}</Badge>
          <Badge variant="outline">{nowBkk}</Badge>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline">Relation age: {relationAgeMin == null ? "-" : `${relationAgeMin}m`}</Badge>
          <Badge variant="outline">CME age: {cmeAgeMin == null ? "-" : `${cmeAgeMin}m`}</Badge>
        </div>
      </div>
    </header>
  );
}
