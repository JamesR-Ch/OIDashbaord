"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { CompactTable, TBody, TD, TH, THead, TR } from "../../components/dashboard/compact-table";
import { RatioBar } from "../../components/dashboard/ratio-bar";
import { SignalChip } from "../../components/dashboard/signal-chip";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtNum } from "../../lib/format";
import { toCmeViewModel } from "../../lib/view-models";

export const dynamic = "force-dynamic";

function tone(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v) || v === 0) return "neutral" as const;
  return v > 0 ? "up" : "down";
}

export default function CmePage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toCmeViewModel(data);

  const cmeAge = ageMinutes(vm.snapshots?.[0]?.snapshot_time_bkk);

  const intraday = (vm.snapshots || []).find((s: any) => s.view_type === "intraday");
  const oi = (vm.snapshots || []).find((s: any) => s.view_type === "oi");

  const topBySnapshot = new Map<string, any[]>();
  for (const row of vm.topActives || []) {
    const arr = topBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    topBySnapshot.set(row.snapshot_id, arr);
  }

  const latestDeltaByView = new Map<string, any>();
  const sortedDeltas = [...(vm.deltas || [])].sort((a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime());
  for (const d of sortedDeltas) if (!latestDeltaByView.has(d.view_type)) latestDeltaByView.set(d.view_type, d);

  return (
    <AppShell status={{ cmeAgeMin: cmeAge }}>
      <PageHeader title="CME Options Monitor" subtitle="Snapshot tape, put/call structure, top active strikes, and change flow." />

      {loading ? <LoadingState title="Loading CME" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-6 md:space-y-7">
      <section className="terminal-grid lg:grid-cols-2">
        {[intraday, oi].filter(Boolean).map((snap: any) => {
          const sk = tone((snap.call_total ?? 0) - (snap.put_total ?? 0));
          return (
            <AnalyticsPanel key={snap.id} title={`${snap.view_type.toUpperCase()} Put/Call Structure`} subtitle={`${snap.series_name} · Exp ${snap.series_expiration_date || "-"} · DTE ${fmtNum(snap.series_dte, 2)}`}>
              <div className="space-y-3">
                <RatioBar leftValue={snap.put_total ?? 0} rightValue={snap.call_total ?? 0} leftLabel="Puts" rightLabel="Calls" tone={sk} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Snapshot</span>
                  <span>{fmtDateTime(snap.snapshot_time_bkk)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Vol / Fut Chg</span>
                  <span className={tone(snap.future_chg) === "up" ? "text-signal-up" : tone(snap.future_chg) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(snap.vol, 2)} / {fmtNum(snap.future_chg, 2)}</span>
                </div>
              </div>
            </AnalyticsPanel>
          );
        })}
      </section>

      <AnalyticsPanel title="CME Snapshot Tape" subtitle="Dense table with directional coloring for volatility and futures changes">
        <CompactTable>
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
            {(vm.snapshots || []).map((row: any) => (
              <TR key={row.id}>
                <TD>{fmtDateTime(row.snapshot_time_bkk)}</TD>
                <TD>{row.view_type}</TD>
                <TD>{row.series_name}</TD>
                <TD>{row.series_expiration_date || "-"}</TD>
                <TD>{fmtNum(row.series_dte, 2)}</TD>
                <TD className="text-signal-down">{row.put_total}</TD>
                <TD className="text-signal-up">{row.call_total}</TD>
                <TD>{fmtNum(row.vol, 2)}</TD>
                <TD className={tone(row.vol_chg) === "up" ? "text-signal-up" : tone(row.vol_chg) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.vol_chg, 2)}</TD>
                <TD className={tone(row.future_chg) === "up" ? "text-signal-up" : tone(row.future_chg) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(row.future_chg, 2)}</TD>
              </TR>
            ))}
          </TBody>
        </CompactTable>
      </AnalyticsPanel>

      <section className="terminal-grid lg:grid-cols-2">
        <AnalyticsPanel title="Top 3 Active Strikes" subtitle="Grouped by latest snapshots">
          <div className="space-y-4">
            {(vm.snapshots || []).slice(0, 2).map((snap: any) => {
              const rows = (topBySnapshot.get(snap.id) || []).sort((a: any, b: any) => a.rank - b.rank);
              return (
                <div key={snap.id} className="rounded-lg border border-border bg-elevated/45 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{snap.view_type.toUpperCase()} · {snap.series_name}</span>
                    <span className="text-muted-foreground">{fmtDateTime(snap.snapshot_time_bkk)}</span>
                  </div>
                  <CompactTable>
                    <THead>
                      <TR><TH>Rank</TH><TH>Strike</TH><TH>Put</TH><TH>Call</TH><TH>Total</TH><TH>Vol Settle</TH></TR>
                    </THead>
                    <TBody>
                      {rows.map((r: any) => (
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
                  </CompactTable>
                </div>
              );
            })}
          </div>
        </AnalyticsPanel>

        <AnalyticsPanel title="Top 3 Strike Changes" subtitle="Latest compare only, same series now vs previous">
          <div className="space-y-4">
            {[...latestDeltaByView.values()].map((delta: any) => {
              const rows = (vm.topStrikeChanges || []).filter((row: any) => row.delta_id === delta.id).sort((a: any, b: any) => a.rank - b.rank);
              return (
                <div key={delta.id} className="rounded-lg border border-border bg-elevated/45 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span>{delta.view_type.toUpperCase()} · {delta.series_name}</span>
                    <SignalChip label={tone(delta.call_change - delta.put_change) === "up" ? "Bullish flow" : "Bearish flow"} tone={tone(delta.call_change - delta.put_change)} />
                  </div>
                  <p className="mb-2 text-[11px] text-muted-foreground">{fmtDateTime(delta.snapshot_time_bkk)} vs {fmtDateTime(delta.previous_snapshot_time_bkk)}</p>
                  <CompactTable>
                    <THead>
                      <TR><TH>Rank</TH><TH>Strike</TH><TH>Put Δ</TH><TH>Call Δ</TH><TH>Total Δ</TH></TR>
                    </THead>
                    <TBody>
                      {rows.length === 0 ? (
                        <TR><TD colSpan={5}>No positive strike changes for this compare.</TD></TR>
                      ) : rows.map((r: any) => (
                        <TR key={`${delta.id}-${r.rank}`}>
                          <TD>{r.rank}</TD>
                          <TD>{r.strike}</TD>
                          <TD className={tone(r.put_change) === "up" ? "text-signal-up" : tone(r.put_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.put_change, 2)}</TD>
                          <TD className={tone(r.call_change) === "up" ? "text-signal-up" : tone(r.call_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.call_change, 2)}</TD>
                          <TD className={tone(r.total_change) === "up" ? "text-signal-up" : tone(r.total_change) === "down" ? "text-signal-down" : "text-signal-neutral"}>{fmtNum(r.total_change, 2)}</TD>
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
      </div>
    </AppShell>
  );
}
