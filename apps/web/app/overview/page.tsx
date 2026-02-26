"use client";

import { AppShell } from "../../components/layout/app-shell";
import { StateBlock } from "../../components/dashboard/state-block";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { KpiCard } from "../../components/dashboard/kpi-card";
import { RatioBar } from "../../components/dashboard/ratio-bar";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { PageSection } from "../../components/layout/page-section";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtDateTimeShort, fmtNum } from "../../lib/format";
import {
  classifyPcr,
  toOverviewViewModel,
  toneFromNumber
} from "../../lib/view-models";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const { data, loading, error } = useOverviewData();
  const vm = toOverviewViewModel(data);

  const cmeAge = ageMinutes(vm.cmeSnapshots?.[0]?.snapshot_time_bkk);

  const intraday = vm.cmeSnapshots.find((s) => s.view_type === "intraday");
  const oi = vm.cmeSnapshots.find((s) => s.view_type === "oi");
  const structureSnapshots = [intraday, oi].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const symbols = ["XAUUSD", "THBUSD", "BTCUSD"];

  const pricesBySymbol = new Map(vm.prices.map((p) => [p.symbol, p]));
  const cmeMarketOpen = vm.marketStatus?.cme_gold?.open;
  const cmeMarketTone = cmeMarketOpen == null ? "neutral" : cmeMarketOpen ? "up" : "down";
  const cmeMarketLabel = cmeMarketOpen == null ? "CME -" : `CME ${cmeMarketOpen ? "OPEN" : "CLOSED"}`;

  function marketForSymbol(symbol: string): { label: string; tone: "up" | "down" | "neutral" } {
    if (symbol === "BTCUSD") return { label: "24/7 OPEN", tone: "up" };
    const state = symbol === "XAUUSD" ? vm.marketStatus?.xauusd : vm.marketStatus?.thbusd;
    if (!state) return { label: "Market -", tone: "neutral" };
    return { label: state.open ? "Market OPEN" : "Market CLOSED", tone: state.open ? "up" : "down" };
  }

  return (
    <AppShell status={{ cmeAgeMin: cmeAge }}>
      <PageHeader title="Decision Dashboard" subtitle="Live cross-asset signal board with CME put/call structure." />

      {loading ? <LoadingState title="Loading dashboard" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-6">
      <PageSection className="md:grid-cols-3">
        {symbols.map((symbol) => {
          const p = pricesBySymbol.get(symbol);
          const tone = toneFromNumber(p?.minute_pct_change ?? null);
          const digits = symbol === "THBUSD" ? 3 : 2;
          const marketInfo = marketForSymbol(symbol);
          const sparklineValues = [
            typeof p?.previous_price === "number" ? p.previous_price : p?.price || 0,
            typeof p?.price === "number" ? p.price : p?.previous_price || 0
          ];
          return (
            <KpiCard
              key={symbol}
              symbol={symbol.replace("USD", " / USD")}
              price={p?.price ?? null}
              digits={digits}
              changeAbs={p?.minute_abs_change ?? null}
              changePct={p?.minute_pct_change ?? null}
              eventTimeLabel={fmtDateTimeShort(p?.event_time_bkk)}
              staleLabel={`${ageMinutes(p?.event_time_bkk) ?? "-"}m ago`}
              tone={tone}
              sparklineValues={sparklineValues}
              marketLabel={marketInfo.label}
              marketTone={marketInfo.tone}
            />
          );
        })}
      </PageSection>

      <PageSection>
        <AnalyticsPanel
          title="CME Gold Options"
          subtitle="Put/Call dynamics and structure signal by view"
          rightSlot={<SignalChip label={cmeMarketLabel} tone={cmeMarketTone} />}
        >
          <div className="space-y-4">
            {structureSnapshots.map((snap) => {
              const pcrSignal = classifyPcr(snap.put_total, snap.call_total);
              return (
                <div key={snap.id} className="space-y-2 rounded-lg border border-border bg-elevated/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="font-medium text-foreground">
                      {snap.view_type.toUpperCase()} · {snap.series_name} · Exp {snap.series_expiration_date || "-"} · DTE {fmtNum(snap.series_dte, 2)}
                    </p>
                    <SignalChip label={pcrSignal.label} tone={pcrSignal.tone} />
                  </div>
                  <RatioBar
                    leftValue={snap.put_total ?? 0}
                    rightValue={snap.call_total ?? 0}
                    leftLabel="Put"
                    rightLabel="Call"
                    tone={pcrSignal.tone}
                    pcr={pcrSignal.pcr}
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{fmtDateTime(snap.snapshot_time_bkk)}</span>
                    <span>Vol {fmtNum(snap.vol, 2)} · Fut {fmtNum(snap.future_chg, 2)}</span>
                  </div>
                </div>
              );
            })}
            {!intraday && !oi ? (
              <StateBlock title="No CME snapshots" detail="Wait for scheduler or run CME manually in settings." />
            ) : null}
          </div>
        </AnalyticsPanel>
      </PageSection>
      </div>
    </AppShell>
  );
}
