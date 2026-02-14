"use client";

import { AppShell } from "../../components/layout/app-shell";
import { StateBlock } from "../../components/dashboard/state-block";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { DecisionTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/decision-table";
import { HeatMatrix } from "../../components/dashboard/heat-matrix";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { PageSection } from "../../components/layout/page-section";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtNum } from "../../lib/format";
import { strengthFromAbsCorrelation, toRelationsViewModel, toneFromNumber } from "../../lib/view-models";

export const dynamic = "force-dynamic";

export default function RelationsPage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toRelationsViewModel(data);
  const relationAge = ageMinutes(vm.relation?.anchor_time_bkk);

  const pairMap = new Map<string, any>();
  for (const pair of vm.relation?.pair_metrics || []) pairMap.set(pair.pair, pair);
  const symbols = ["XAUUSD", "THBUSD", "BTCUSD"];
  const corr = (a: string, b: string) => {
    if (a === b) return 1;
    return pairMap.get(`${a}_${b}`)?.correlation ?? pairMap.get(`${b}_${a}`)?.correlation ?? null;
  };

  return (
    <AppShell status={{ relationAgeMin: relationAge }}>
      <PageHeader title="Relation Analytics" subtitle="Cross-asset 30m relation map with pair-level decision signals." />

      {loading ? <LoadingState title="Loading relations" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-6 md:space-y-7">
        {!vm.relation ? (
          <AnalyticsPanel title="No relation data" subtitle="Run relation job or wait for schedule.">
            <StateBlock title="No snapshot currently available." detail="This page updates on the 30-minute relation scheduler." />
          </AnalyticsPanel>
        ) : (
          <>
          <AnalyticsPanel
            title="Relation Heatmap"
            subtitle={`Window ${fmtDateTime(vm.relation.window_start_bkk)} - ${fmtDateTime(vm.relation.window_end_bkk)}`}
            rightSlot={
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Latest calc</p>
                <p className="text-xs text-foreground/90">{fmtDateTime(vm.relation.anchor_time_bkk)}</p>
              </div>
            }
          >
            <HeatMatrix symbols={symbols} valueAt={corr} />

            <div className="mt-4 flex flex-wrap gap-2">
              <SignalChip label={`Open: ${(vm.relation.quality_flags?.open_symbols || []).join(", ") || "-"}`} tone="up" />
              <SignalChip label={`Closed: ${(vm.relation.quality_flags?.closed_symbols || []).join(", ") || "-"}`} tone="down" />
              <SignalChip label={`Degraded: ${(vm.relation.quality_flags?.degraded_symbols || []).join(", ") || "-"}`} tone="neutral" />
            </div>
          </AnalyticsPanel>

          <PageSection className="lg:grid-cols-2">
            <AnalyticsPanel title="Pair Decision Signals" subtitle="Outperforming/underperforming cues by relative strength and correlation">
              <div className="space-y-2 text-sm">
                {(vm.relation.pair_metrics || []).map((p) => {
                  const relTone = toneFromNumber(p.relative_strength);
                  const corrAbs = Math.abs(typeof p.correlation === "number" ? p.correlation : 0);
                  const strength = strengthFromAbsCorrelation(corrAbs);
                  return (
                    <div key={p.pair} className="rounded-md border border-border bg-elevated/45 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{p.pair.replaceAll("_", " / ")}</p>
                        <SignalChip label={relTone === "up" ? "Outperforming" : relTone === "down" ? "Underperforming" : "Neutral"} tone={relTone} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Strength {strength} · Corr {fmtNum(p.correlation, 2)} · Beta {fmtNum(p.beta, 2)} · Z {fmtNum(p.z_score, 2)}</p>
                    </div>
                  );
                })}
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel title="Per Symbol (30m)" subtitle="Raw metric tape">
              <DecisionTable>
                <THead>
                  <TR>
                    <TH>Symbol</TH>
                    <TH>Current</TH>
                    <TH>Previous</TH>
                    <TH>Abs</TH>
                    <TH>%</TH>
                    <TH>Points</TH>
                    <TH>Deg.</TH>
                  </TR>
                </THead>
                <TBody>
                  {(vm.relation.symbol_returns || []).map((row) => (
                    <TR key={row.symbol}>
                      <TD>{row.symbol}</TD>
                      <TD>{fmtNum(row.current_price, 2)}</TD>
                      <TD>{fmtNum(row.previous_price, 2)}</TD>
                      <TD className={toneFromNumber(row.abs_change) === "up" ? "text-signal-up" : toneFromNumber(row.abs_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.abs_change, 2)}</TD>
                      <TD className={toneFromNumber(row.pct_change) === "up" ? "text-signal-up" : toneFromNumber(row.pct_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.pct_change, 2)}</TD>
                      <TD>{row.points_observed ?? "-"}</TD>
                      <TD>{row.degraded ? "yes" : "no"}</TD>
                    </TR>
                  ))}
                </TBody>
              </DecisionTable>
            </AnalyticsPanel>
          </PageSection>
          </>
        )}
      </div>
    </AppShell>
  );
}
