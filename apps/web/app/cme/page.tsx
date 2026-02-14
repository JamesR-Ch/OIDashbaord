"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { DecisionTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/decision-table";
import { RatioBar } from "../../components/dashboard/ratio-bar";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { PageSection } from "../../components/layout/page-section";
import { StateBlock } from "../../components/dashboard/state-block";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtNum } from "../../lib/format";
import { toCmeViewModel, toneFromNumber } from "../../lib/view-models";

export const dynamic = "force-dynamic";

export default function CmePage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toCmeViewModel(data);

  const cmeAge = ageMinutes(vm.snapshots?.[0]?.snapshot_time_bkk);

  const intraday = vm.snapshots.find((s) => s.view_type === "intraday");
  const oi = vm.snapshots.find((s) => s.view_type === "oi");
  const structureSnapshots = [intraday, oi].filter((s): s is NonNullable<typeof s> => Boolean(s));

  const topBySnapshot = new Map<string, typeof vm.topActives>();
  for (const row of vm.topActives) {
    const arr = topBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    topBySnapshot.set(row.snapshot_id, arr);
  }

  const latestDeltaByView = new Map<string, typeof vm.deltas[number]>();
  const sortedDeltas = [...vm.deltas].sort((a, b) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime());
  for (const d of sortedDeltas) if (!latestDeltaByView.has(d.view_type)) latestDeltaByView.set(d.view_type, d);

  return (
    <AppShell status={{ cmeAgeMin: cmeAge }} marketStatus={vm.marketStatus}>
      <PageHeader title="CME Options Monitor" subtitle="Snapshot tape, put/call structure, top active strikes, and change flow." />

      {loading ? <LoadingState title="Loading CME" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-6">
      <PageSection className="lg:grid-cols-2">
        {structureSnapshots.map((snap) => {
          const sk = toneFromNumber((snap.call_total ?? 0) - (snap.put_total ?? 0));
          return (
            <AnalyticsPanel key={snap.id} title={`${snap.view_type.toUpperCase()} Put/Call Structure`} subtitle={`${snap.series_name} · Exp ${snap.series_expiration_date || "-"} · DTE ${fmtNum(snap.series_dte, 2)}`}>
              <div className="space-y-2">
                <RatioBar leftValue={snap.put_total ?? 0} rightValue={snap.call_total ?? 0} leftLabel="Puts" rightLabel="Calls" tone={sk} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Snapshot</span>
                  <span>{fmtDateTime(snap.snapshot_time_bkk)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Vol / Fut Chg</span>
                  <span className={toneFromNumber(snap.future_chg) === "up" ? "text-signal-up" : toneFromNumber(snap.future_chg) === "down" ? "text-signal-down" : "text-signal-neutral"}>
                    {fmtNum(snap.vol, 2)} / {fmtNum(snap.future_chg, 2)}
                  </span>
                </div>
              </div>
            </AnalyticsPanel>
          );
        })}
        {!intraday && !oi ? (
          <StateBlock title="No CME structures yet" detail="No intraday or OI snapshot available at this moment." />
        ) : null}
      </PageSection>

      <AnalyticsPanel title="CME Snapshot Tape" subtitle="Dense table with directional coloring for volatility and futures changes">
        <DecisionTable>
          <THead>
            <TR>
              <TH>Time (BKK)</TH>
              <TH>Type</TH>
              <TH>Series</TH>
              <TH>Exp Date</TH>
              <TH>DTE</TH>
              <TH>Put</TH>
              <TH>Call</TH>
              <TH>Vol</TH>
              <TH>Vol Chg</TH>
              <TH>Fut Chg</TH>
            </TR>
          </THead>
          <TBody>
            {vm.snapshots.map((row) => (
              <TR key={row.id}>
                <TD>{fmtDateTime(row.snapshot_time_bkk)}</TD>
                <TD>{row.view_type}</TD>
                <TD>{row.series_name}</TD>
                <TD>{row.series_expiration_date || "-"}</TD>
                <TD>{fmtNum(row.series_dte, 2)}</TD>
                <TD className="text-signal-down">{row.put_total}</TD>
                <TD className="text-signal-up">{row.call_total}</TD>
                <TD>{fmtNum(row.vol, 2)}</TD>
                <TD className={toneFromNumber(row.vol_chg) === "up" ? "text-signal-up" : toneFromNumber(row.vol_chg) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.vol_chg, 2)}</TD>
                <TD className={toneFromNumber(row.future_chg) === "up" ? "text-signal-up" : toneFromNumber(row.future_chg) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.future_chg, 2)}</TD>
              </TR>
            ))}
          </TBody>
        </DecisionTable>
      </AnalyticsPanel>

      <PageSection className="lg:grid-cols-2">
        <AnalyticsPanel title="Top 3 Active Strikes" subtitle="Grouped by latest snapshots">
          <div className="space-y-4">
            {vm.snapshots.slice(0, 2).map((snap) => {
              const rows = (topBySnapshot.get(snap.id) || []).sort((a, b) => a.rank - b.rank);
              return (
                <div key={snap.id} className="rounded-lg border border-border bg-elevated/45 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{snap.view_type.toUpperCase()} · {snap.series_name}</span>
                    <span className="text-muted-foreground">{fmtDateTime(snap.snapshot_time_bkk)}</span>
                  </div>
                  <DecisionTable compact>
                    <THead>
                      <TR><TH>Rank</TH><TH>Strike</TH><TH>Put</TH><TH>Call</TH><TH>Total</TH><TH>Vol Settle</TH></TR>
                    </THead>
                    <TBody>
                      {rows.map((r) => (
                        <TR key={`${snap.id}-${r.rank}`}>
                          <TD>{r.rank}</TD>
                          <TD>{r.strike}</TD>
                          <TD className="text-signal-down">{r.put}</TD>
                          <TD className="text-signal-up">{r.call}</TD>
                          <TD>{r.total}</TD>
                          <TD>{fmtNum(r.vol_settle, 2)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </DecisionTable>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Top 3 Strike Changes" subtitle="Latest compare only, same series now vs previous">
          <div className="space-y-4">
            {[...latestDeltaByView.values()].map((delta) => {
              const rows = vm.topStrikeChanges.filter((row) => row.delta_id === delta.id).sort((a, b) => a.rank - b.rank);
              return (
                <div key={delta.id} className="rounded-lg border border-border bg-elevated/45 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{delta.view_type.toUpperCase()} · {delta.series_name}</span>
                    <SignalChip label={toneFromNumber(delta.call_change - delta.put_change) === "up" ? "Bullish flow" : "Bearish flow"} tone={toneFromNumber(delta.call_change - delta.put_change)} />
                  </div>
                  <p className="mb-2 text-[11px] text-muted-foreground">{fmtDateTime(delta.snapshot_time_bkk)} vs {fmtDateTime(delta.previous_snapshot_time_bkk)}</p>
                  <DecisionTable compact>
                    <THead>
                      <TR><TH>Rank</TH><TH>Strike</TH><TH>Put Δ</TH><TH>Call Δ</TH><TH>Total Δ</TH></TR>
                    </THead>
                    <TBody>
                      {rows.length === 0 ? (
                        <TR><TD colSpan={5}>No positive strike changes for this compare.</TD></TR>
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
