"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { useOverviewData } from "../../lib/use-overview-data";
import { fmtDateTime, fmtNum } from "../../lib/format";
import { toCmeViewModel } from "../../lib/view-models";

export const dynamic = "force-dynamic";

export default function CmePage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toCmeViewModel(data);

  const topBySnapshot = new Map<string, any[]>();
  for (const row of vm.topActives || []) {
    const arr = topBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    topBySnapshot.set(row.snapshot_id, arr);
  }

  const sortedSnapshots = [...(vm.snapshots || [])].sort(
    (a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime()
  );
  const sortedDeltas = [...(vm.deltas || [])].sort(
    (a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime()
  );

  const latestDeltaByView = new Map<string, any>();
  for (const row of sortedDeltas) {
    if (!latestDeltaByView.has(row.view_type)) latestDeltaByView.set(row.view_type, row);
  }
  const latestDeltas = [...latestDeltaByView.values()];

  return (
    <AppShell>
      <PageHeader
        title="CME"
        subtitle="Intraday + OI snapshots, top active strikes, and latest strike change analytics."
      />

      {loading ? <LoadingState title="Loading CME" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>CME Snapshots</CardTitle>
          <CardDescription>Type / Series / Exp Date / DTE / Put / Call / Vol / Vol Chg / Fut Chg</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="table-shell">
            <Table>
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
                    <TD>{row.put_total}</TD>
                    <TD>{row.call_total}</TD>
                    <TD>{fmtNum(row.vol, 2)}</TD>
                    <TD>{fmtNum(row.vol_chg, 2)}</TD>
                    <TD>{fmtNum(row.future_chg, 2)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 3 Active Strikes</CardTitle>
            <CardDescription>Grouped by snapshot and view type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sortedSnapshots.map((snapshot: any) => {
              const rows = (topBySnapshot.get(snapshot.id) || []).sort((a, b) => a.rank - b.rank);
              return (
                <div key={snapshot.id} className="rounded-lg border border-border bg-card/40 p-3">
                  <p className="text-sm font-medium">
                    {snapshot.view_type.toUpperCase()} · {snapshot.series_name} · {snapshot.series_expiration_date || "-"} · DTE {fmtNum(snapshot.series_dte, 2)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(snapshot.snapshot_time_bkk)}</p>
                  <div className="mt-2 table-shell">
                    <Table>
                      <THead>
                        <TR>
                          <TH>Rank</TH>
                          <TH>Strike</TH>
                          <TH>Put</TH>
                          <TH>Call</TH>
                          <TH>Total</TH>
                          <TH>Vol Settle</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {rows.map((row: any, idx: number) => (
                          <TR key={`${snapshot.id}-${row.rank}-${idx}`}>
                            <TD>{row.rank}</TD>
                            <TD>{row.strike}</TD>
                            <TD>{row.put}</TD>
                            <TD>{row.call}</TD>
                            <TD>{row.total}</TD>
                            <TD>{fmtNum(row.vol_settle, 2)}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 3 Strike Changes</CardTitle>
            <CardDescription>Latest compare only, same series now vs previous</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!latestDeltas.length ? (
              <p className="text-sm text-muted-foreground">No delta data yet.</p>
            ) : (
              latestDeltas.map((delta: any) => {
                const rows = (vm.topStrikeChanges || [])
                  .filter((row: any) => row.delta_id === delta.id)
                  .sort((a: any, b: any) => a.rank - b.rank);
                return (
                  <div key={delta.id} className="rounded-lg border border-border bg-card/40 p-3">
                    <p className="text-sm font-medium">{delta.view_type.toUpperCase()} · {delta.series_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDateTime(delta.snapshot_time_bkk)} vs {fmtDateTime(delta.previous_snapshot_time_bkk)}
                    </p>
                    <div className="mt-2 table-shell">
                      <Table>
                        <THead>
                          <TR>
                            <TH>Rank</TH>
                            <TH>Strike</TH>
                            <TH>Put (Prev→Now)</TH>
                            <TH>Call (Prev→Now)</TH>
                            <TH>Total Δ</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {!rows.length ? (
                            <TR>
                              <TD colSpan={5}>No positive strike changes for latest compare.</TD>
                            </TR>
                          ) : (
                            rows.map((row: any) => (
                              <TR key={`${delta.id}-${row.rank}`}>
                                <TD>{row.rank}</TD>
                                <TD>{row.strike}</TD>
                                <TD>{row.put_before} → {row.put_now} ({fmtNum(row.put_change, 2)})</TD>
                                <TD>{row.call_before} → {row.call_now} ({fmtNum(row.call_change, 2)})</TD>
                                <TD>{fmtNum(row.total_change, 2)}</TD>
                              </TR>
                            ))
                          )}
                        </TBody>
                      </Table>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
