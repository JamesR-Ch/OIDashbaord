"use client";

import { AppShell } from "../../components/layout/app-shell";
import { StateBlock } from "../../components/dashboard/state-block";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { DecisionTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/decision-table";
import { HeatMatrix } from "../../components/dashboard/heat-matrix";
import { KpiCard } from "../../components/dashboard/kpi-card";
import { RatioBar } from "../../components/dashboard/ratio-bar";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { PageSection } from "../../components/layout/page-section";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtDateTimeShort, fmtNum } from "../../lib/format";
import { RelationPairMetricVM, strengthFromAbsCorrelation, toOverviewViewModel, toneFromNumber } from "../../lib/view-models";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toOverviewViewModel(data);

  const relationAge = ageMinutes(vm.relation?.anchor_time_bkk);
  const cmeAge = ageMinutes(vm.cmeSnapshots?.[0]?.snapshot_time_bkk);

  const intraday = vm.cmeSnapshots.find((s) => s.view_type === "intraday");
  const oi = vm.cmeSnapshots.find((s) => s.view_type === "oi");
  const structureSnapshots = [intraday, oi].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const pairMap = new Map<string, RelationPairMetricVM>();
  for (const pair of vm.relation?.pair_metrics || []) pairMap.set(pair.pair, pair);
  const corr = (a: string, b: string) => {
    if (a === b) return 1;
    const key = `${a}_${b}`;
    const rev = `${b}_${a}`;
    return pairMap.get(key)?.correlation ?? pairMap.get(rev)?.correlation ?? null;
  };
  const symbols = ["XAUUSD", "THBUSD", "BTCUSD"];

  const latestDeltaByView = new Map<string, typeof vm.cmeDeltas[number]>();
  const sortedDeltas = [...vm.cmeDeltas].sort((a, b) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime());
  for (const d of sortedDeltas) if (!latestDeltaByView.has(d.view_type)) latestDeltaByView.set(d.view_type, d);

  const topActivesBySnapshot = new Map<string, typeof vm.topActives>();
  for (const row of vm.topActives) {
    const arr = topActivesBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    topActivesBySnapshot.set(row.snapshot_id, arr);
  }

  const pricesBySymbol = new Map(vm.prices.map((p) => [p.symbol, p]));

  return (
    <AppShell status={{ relationAgeMin: relationAge, cmeAgeMin: cmeAge }} marketStatus={vm.marketStatus}>
      <PageHeader title="Decision Dashboard" subtitle="Live cross-asset signal board with CME put/call structure and relation analytics." />

      {loading ? <LoadingState title="Loading dashboard" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-6">
      <PageSection className="md:grid-cols-3">
        {symbols.map((symbol) => {
          const p = pricesBySymbol.get(symbol);
          const tone = toneFromNumber(p?.minute_pct_change ?? null);
          const digits = symbol === "THBUSD" ? 3 : 2;
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
            />
          );
        })}
      </PageSection>

      <PageSection className="lg:grid-cols-[1.75fr_1fr]">
        <AnalyticsPanel title="CME Gold Options" subtitle="Put/Call dynamics and structure signal by view">
          <div className="space-y-4">
            {structureSnapshots.map((snap) => {
              const tone = toneFromNumber((snap.call_total ?? 0) - (snap.put_total ?? 0));
              return (
                <div key={snap.id} className="space-y-2 rounded-lg border border-border bg-elevated/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="font-medium text-foreground">
                      {snap.view_type.toUpperCase()} · {snap.series_name} · Exp {snap.series_expiration_date || "-"} · DTE {fmtNum(snap.series_dte, 2)}
                    </p>
                    <SignalChip label={tone === "up" ? "Bullish skew" : tone === "down" ? "Bearish skew" : "Balanced"} tone={tone} />
                  </div>
                  <RatioBar
                    leftValue={snap.put_total ?? 0}
                    rightValue={snap.call_total ?? 0}
                    leftLabel="Put"
                    rightLabel="Call"
                    tone={tone}
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

        <AnalyticsPanel title="Relation Matrix (30m)" subtitle="Correlation heatmap and pair-level outcomes">
          <div className="space-y-3">
            <HeatMatrix symbols={symbols} valueAt={corr} />

            <div className="space-y-1.5 text-xs">
              {(vm.relation?.pair_metrics || []).map((p) => {
                const tone = toneFromNumber(p.relative_strength);
                const strength = strengthFromAbsCorrelation(Math.abs(p.correlation ?? 0));
                const text = tone === "up" ? "Outperforming" : tone === "down" ? "Underperforming" : "Neutral";
                return (
                  <div key={p.pair} className="flex items-center justify-between rounded-md border border-border bg-elevated/40 px-2 py-1.5">
                    <span>{p.pair.replaceAll("_", " / ")} · {strength}</span>
                    <span className={tone === "up" ? "text-signal-up" : tone === "down" ? "text-signal-down" : "text-signal-neutral"}>
                      {text}
                    </span>
                  </div>
                );
              })}
              {!vm.relation ? (
                <StateBlock title="No relation snapshot" detail="Waiting for 30m relation job output." />
              ) : null}
            </div>
          </div>
        </AnalyticsPanel>
      </PageSection>

      <PageSection className="lg:grid-cols-[1fr_1.15fr]">
        <AnalyticsPanel title="Top Active Strikes" subtitle="Top 3 by intraday and OI">
          <div className="space-y-4">
            {vm.cmeSnapshots.slice(0, 2).map((snap) => {
              const rows = (topActivesBySnapshot.get(snap.id) || []).sort((a, b) => a.rank - b.rank);
              return (
                <div key={snap.id}>
                  <p className="mb-1.5 text-xs text-muted-foreground">{snap.view_type.toUpperCase()} · {snap.series_name} · {fmtDateTime(snap.snapshot_time_bkk)}</p>
                  <DecisionTable>
                    <THead>
                      <TR>
                        <TH>Strike</TH>
                        <TH>Put</TH>
                        <TH>Call</TH>
                        <TH>Total</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {rows.map((r) => (
                        <TR key={`${snap.id}-${r.rank}`}>
                          <TD>{r.strike}</TD>
                          <TD className="text-signal-down">{r.put}</TD>
                          <TD className="text-signal-up">{r.call}</TD>
                          <TD>{r.total}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </DecisionTable>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Latest CME Strike Changes" subtitle="Current vs previous snapshot (same series)">
          <div className="space-y-4">
            {[...latestDeltaByView.values()].map((delta) => {
              const rows = vm.cmeTopStrikeChanges.filter((r) => r.delta_id === delta.id).sort((a, b) => a.rank - b.rank);
              return (
                <div key={delta.id} className="rounded-lg border border-border bg-elevated/45 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{delta.view_type.toUpperCase()} · {delta.series_name}</span>
                    <span className="text-muted-foreground">{fmtDateTime(delta.snapshot_time_bkk)} vs {fmtDateTime(delta.previous_snapshot_time_bkk)}</span>
                  </div>
                  <DecisionTable>
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
                      ) : rows.map((r) => (
                        <TR key={`${delta.id}-${r.rank}`}>
                          <TD>{r.rank}</TD>
                          <TD>{r.strike}</TD>
                          <TD className={toneFromNumber(r.put_change) === "up" ? "text-signal-up" : toneFromNumber(r.put_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.put_change, 2)}</TD>
                          <TD className={toneFromNumber(r.call_change) === "up" ? "text-signal-up" : toneFromNumber(r.call_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.call_change, 2)}</TD>
                          <TD className={toneFromNumber(r.total_change) === "up" ? "text-signal-up" : toneFromNumber(r.total_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.total_change, 2)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </DecisionTable>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>
      </PageSection>
      </div>
    </AppShell>
  );
}
