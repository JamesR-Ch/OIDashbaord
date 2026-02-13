"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { CompactTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/compact-table";
import { HeatCell } from "../../components/dashboard/heat-cell";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtNum } from "../../lib/format";
import { toRelationsViewModel } from "../../lib/view-models";

export const dynamic = "force-dynamic";

function tone(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v) || v === 0) return "neutral" as const;
  return v > 0 ? "up" : "down";
}

function strengthText(absCorr: number) {
  if (absCorr >= 0.7) return "strong";
  if (absCorr >= 0.4) return "moderate";
  return "weak";
}

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

      {!vm.relation ? (
        <AnalyticsPanel title="No relation data" subtitle="Run relation job or wait for schedule.">
          <p className="text-sm text-muted-foreground">No snapshot currently available.</p>
        </AnalyticsPanel>
      ) : (
        <>
          <AnalyticsPanel title="Relation Heatmap" subtitle={`Window ${fmtDateTime(vm.relation.window_start_bkk)} - ${fmtDateTime(vm.relation.window_end_bkk)}`}>
            <div className="grid grid-cols-4 gap-2">
              <div />
              {symbols.map((s) => <div key={s} className="text-center text-[11px] text-muted-foreground">{s.replace("USD", "")}</div>)}
              {symbols.map((row) => (
                <>
                  <div key={`${row}-lbl`} className="text-[11px] text-muted-foreground">{row.replace("USD", "")}</div>
                  {symbols.map((col) => (
                    <HeatCell key={`${row}-${col}`} value={corr(row, col)} isDiagonal={row === col} />
                  ))}
                </>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <SignalChip label={`Open: ${(vm.relation.quality_flags?.open_symbols || []).join(", ") || "-"}`} tone="up" />
              <SignalChip label={`Closed: ${(vm.relation.quality_flags?.closed_symbols || []).join(", ") || "-"}`} tone="down" />
              <SignalChip label={`Degraded: ${(vm.relation.quality_flags?.degraded_symbols || []).join(", ") || "-"}`} tone="neutral" />
            </div>
          </AnalyticsPanel>

          <section className="terminal-grid lg:grid-cols-2">
            <AnalyticsPanel title="Pair Decision Signals" subtitle="Outperforming/underperforming cues by relative strength and correlation">
              <div className="space-y-2 text-sm">
                {(vm.relation.pair_metrics || []).map((p: any) => {
                  const relTone = tone(p.relative_strength);
                  const corrAbs = Math.abs(typeof p.correlation === "number" ? p.correlation : 0);
                  return (
                    <div key={p.pair} className="rounded-md border border-border bg-elevated/45 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{p.pair.replaceAll("_", " / ")}</p>
                        <SignalChip label={relTone === "up" ? "Outperforming" : relTone === "down" ? "Underperforming" : "Neutral"} tone={relTone} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Correlation {strengthText(corrAbs)} · Corr {fmtNum(p.correlation, 2)} · Beta {fmtNum(p.beta, 2)} · Z {fmtNum(p.z_score, 2)}</p>
                    </div>
                  );
                })}
              </div>
            </AnalyticsPanel>

            <AnalyticsPanel title="Per Symbol (30m)" subtitle="Raw metric tape">
              <CompactTable>
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
                  {(vm.relation.symbol_returns || []).map((row: any) => (
                    <TR key={row.symbol}>
                      <TD>{row.symbol}</TD>
                      <TD>{fmtNum(row.current_price, 2)}</TD>
                      <TD>{fmtNum(row.previous_price, 2)}</TD>
                      <TD className={tone(row.abs_change) === "up" ? "text-signal-up" : tone(row.abs_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.abs_change, 2)}</TD>
                      <TD className={tone(row.pct_change) === "up" ? "text-signal-up" : tone(row.pct_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.pct_change, 2)}</TD>
                      <TD>{row.points_observed ?? "-"}</TD>
                      <TD>{row.degraded ? "yes" : "no"}</TD>
                    </TR>
                  ))}
                </TBody>
              </CompactTable>
            </AnalyticsPanel>
          </section>
        </>
      )}
    </AppShell>
  );
}
