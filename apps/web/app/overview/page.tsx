"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { CompactTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/compact-table";
import { HeatCell } from "../../components/dashboard/heat-cell";
import { MetricCard } from "../../components/dashboard/metric-card";
import { RatioBar } from "../../components/dashboard/ratio-bar";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtNum } from "../../lib/format";
import { toOverviewViewModel } from "../../lib/view-models";

export const dynamic = "force-dynamic";

function toneOf(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "neutral" as const;
  return value > 0 ? "up" : "down";
}

export default function OverviewPage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toOverviewViewModel(data);

  const relationAge = ageMinutes(vm.relation?.anchor_time_bkk);
  const cmeAge = ageMinutes(vm.cmeSnapshots?.[0]?.snapshot_time_bkk);

  const intraday = (vm.cmeSnapshots || []).find((s: any) => s.view_type === "intraday");
  const oi = (vm.cmeSnapshots || []).find((s: any) => s.view_type === "oi");

  const pairMap = new Map<string, any>();
  for (const pair of vm.relation?.pair_metrics || []) pairMap.set(pair.pair, pair);
  const corr = (a: string, b: string) => {
    if (a === b) return 1;
    const key = `${a}_${b}`;
    const rev = `${b}_${a}`;
    return pairMap.get(key)?.correlation ?? pairMap.get(rev)?.correlation ?? null;
  };
  const symbols = ["XAUUSD", "THBUSD", "BTCUSD"];

  const latestDeltaByView = new Map<string, any>();
  const sortedDeltas = [...(vm.cmeDeltas || [])].sort((a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime());
  for (const d of sortedDeltas) if (!latestDeltaByView.has(d.view_type)) latestDeltaByView.set(d.view_type, d);

  const topActivesBySnapshot = new Map<string, any[]>();
  for (const row of vm.topActives || []) {
    const arr = topActivesBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    topActivesBySnapshot.set(row.snapshot_id, arr);
  }

  return (
    <AppShell status={{ relationAgeMin: relationAge, cmeAgeMin: cmeAge }}>
      <PageHeader title="Decision Dashboard" subtitle="Live cross-asset signal board with CME put/call structure and relation analytics." />

      {loading ? <LoadingState title="Loading dashboard" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <section className="terminal-grid md:grid-cols-3">
        {(vm.prices || []).map((p: any) => {
          const tone = toneOf(p.minute_pct_change);
          return (
            <MetricCard
              key={p.symbol}
              title={p.symbol.replace("USD", " / USD")}
              value={fmtNum(p.price, p.symbol === "THBUSD" ? 3 : 2)}
              subtitle={`${fmtDateTime(p.event_time_bkk)} · ${ageMinutes(p.event_time_bkk) ?? "-"}m ago`}
              signal={{
                label: `${fmtNum(p.minute_abs_change, 2)} (${fmtNum(p.minute_pct_change, 2)}%)`,
                tone
              }}
            />
          );
        })}
      </section>

      <section className="terminal-grid lg:grid-cols-[1.7fr_1fr]">
        <AnalyticsPanel title="CME Gold Options" subtitle="Put/Call dynamics and structure signal by view">
          <div className="space-y-5">
            {[intraday, oi].filter(Boolean).map((snap: any) => {
              const tone = toneOf((snap.call_total ?? 0) - (snap.put_total ?? 0));
              return (
                <div key={snap.id} className="space-y-2 rounded-lg border border-border bg-elevated/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="font-medium text-foreground">{snap.view_type.toUpperCase()} · {snap.series_name} · DTE {fmtNum(snap.series_dte, 2)}</p>
                    <SignalChip label={tone === "up" ? "Bullish skew" : tone === "down" ? "Bearish skew" : "Balanced"} tone={tone} />
                  </div>
                  <RatioBar
                    leftValue={snap.put_total ?? 0}
                    rightValue={snap.call_total ?? 0}
                    leftLabel="Put"
                    rightLabel="Call"
                    tone={tone}
                  />
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Relation Matrix (30m)" subtitle="Correlation heatmap and pair quick signals">
          <div className="space-y-3">
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

            <div className="space-y-1.5 text-xs">
              {(vm.relation?.pair_metrics || []).map((p: any) => {
                const tone = toneOf(p.relative_strength);
                const text = tone === "up" ? "Outperforming" : tone === "down" ? "Underperforming" : "Neutral";
                return (
                  <div key={p.pair} className="flex items-center justify-between rounded-md border border-border bg-elevated/40 px-2 py-1.5">
                    <span>{p.pair.replaceAll("_", " / ")}</span>
                    <span className={tone === "up" ? "text-signal-up" : tone === "down" ? "text-signal-down" : "text-signal-neutral"}>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </AnalyticsPanel>
      </section>

      <section className="terminal-grid lg:grid-cols-[1fr_1.2fr]">
        <AnalyticsPanel title="Top Active Strikes" subtitle="Top 3 by intraday and OI">
          <div className="space-y-4">
            {(vm.cmeSnapshots || []).slice(0, 2).map((snap: any) => {
              const rows = (topActivesBySnapshot.get(snap.id) || []).sort((a: any, b: any) => a.rank - b.rank);
              return (
                <div key={snap.id}>
                  <p className="mb-1.5 text-xs text-muted-foreground">{snap.view_type.toUpperCase()} · {snap.series_name} · {fmtDateTime(snap.snapshot_time_bkk)}</p>
                  <CompactTable>
                    <THead>
                      <TR>
                        <TH>Strike</TH>
                        <TH>Put</TH>
                        <TH>Call</TH>
                        <TH>Total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {rows.map((r: any) => (
                        <TR key={`${snap.id}-${r.rank}`}>
                          <TD>{r.strike}</TD>
                          <TD className="text-signal-down">{r.put}</TD>
                          <TD className="text-signal-up">{r.call}</TD>
                          <TD>{r.total}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </CompactTable>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Latest CME Strike Changes" subtitle="Current vs previous snapshot (same series)">
          <div className="space-y-4">
            {[...latestDeltaByView.values()].map((delta: any) => {
              const rows = (vm.cmeTopStrikeChanges || []).filter((r: any) => r.delta_id === delta.id).sort((a: any, b: any) => a.rank - b.rank);
              return (
                <div key={delta.id} className="rounded-lg border border-border bg-elevated/45 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{delta.view_type.toUpperCase()} · {delta.series_name}</span>
                    <span className="text-muted-foreground">{fmtDateTime(delta.snapshot_time_bkk)} vs {fmtDateTime(delta.previous_snapshot_time_bkk)}</span>
                  </div>
                  <CompactTable>
                    <THead>
                      <TR>
                        <TH>Rank</TH>
                        <TH>Strike</TH>
                        <TH>Put Δ</TH>
                        <TH>Call Δ</TH>
                        <TH>Total Δ</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {rows.length === 0 ? (
                        <TR><TD colSpan={5}>No positive change rows.</TD></TR>
                      ) : rows.map((r: any) => (
                        <TR key={`${delta.id}-${r.rank}`}>
                          <TD>{r.rank}</TD>
                          <TD>{r.strike}</TD>
                          <TD className={toneOf(r.put_change) === "up" ? "text-signal-up" : toneOf(r.put_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.put_change, 2)}</TD>
                          <TD className={toneOf(r.call_change) === "up" ? "text-signal-up" : toneOf(r.call_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.call_change, 2)}</TD>
                          <TD className={toneOf(r.total_change) === "up" ? "text-signal-up" : toneOf(r.total_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.total_change, 2)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </CompactTable>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>
      </section>
    </AppShell>
  );
}
