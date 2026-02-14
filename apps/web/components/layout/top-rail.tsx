"use client";

import { Menu } from "lucide-react";
import { DashboardMarketStatusVM } from "../../lib/view-models";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface TopRailProps {
  nowUtc: string;
  nowBkk: string;
  relationAgeMin?: number | null;
  cmeAgeMin?: number | null;
  marketStatus?: DashboardMarketStatusVM | null;
  isLoggedIn: boolean;
  onOpenNav: () => void;
}

export function TopRail({
  nowUtc,
  nowBkk,
  relationAgeMin,
  cmeAgeMin,
  marketStatus,
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

      {marketStatus ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={marketStatus.xauusd.open ? "success" : "warning"}>
            XAUUSD {marketStatus.xauusd.open ? "OPEN" : "CLOSED"}
          </Badge>
          <Badge variant={marketStatus.thbusd.open ? "success" : "warning"}>
            THBUSD {marketStatus.thbusd.open ? "OPEN" : "CLOSED"}
          </Badge>
          <Badge variant={marketStatus.cme_gold.open ? "success" : "warning"}>
            CME {marketStatus.cme_gold.open ? "OPEN" : "CLOSED"}
          </Badge>
        </div>
      ) : null}
    </header>
  );
}
