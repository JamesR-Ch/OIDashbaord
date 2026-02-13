"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { useOverviewData } from "../../lib/use-overview-data";
import { ageMinutes, fmtDateTime, fmtNum } from "../../lib/format";
import { toOverviewViewModel } from "../../lib/view-models";

export const dynamic = "force-dynamic";

function toneByAge(minutes: number | null, threshold = 35) {
  if (minutes == null) return "outline" as const;
  return minutes > threshold ? "warning" : "success";
}

export default function OverviewPage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toOverviewViewModel(data);

  const relationAge = ageMinutes(vm.relation?.anchor_time_bkk);
  const cmeAge = ageMinutes(vm.cmeSnapshots?.[0]?.snapshot_time_bkk);

  const jobsByName = new Map<string, any>();
  for (const job of vm.jobs || []) {
    if (!jobsByName.has(job.job_name)) jobsByName.set(job.job_name, job);
  }

  const sortedDeltas = [...(vm.cmeDeltas || [])].sort(
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
        title="Overview"
        subtitle="Decision cockpit for live prices, 30-minute relation engine, and CME OI/Intraday deltas."
      />

      {loading ? <LoadingState title="Loading overview" /> : null}
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {vm.prices.map((p: any) => {
          const rel = (vm.relation?.symbol_returns || []).find((row: any) => row.symbol === p.symbol);
          const minuteAbs = typeof p.minute_abs_change === "number" ? p.minute_abs_change : rel?.minute_abs_change;
          const minutePct = typeof p.minute_pct_change === "number" ? p.minute_pct_change : rel?.minute_pct_change;
          return (
            <Card key={p.symbol} className="relative overflow-hidden">
              <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
              <CardHeader>
                <CardTitle className="text-sm">{p.symbol}</CardTitle>
                <CardDescription>Latest 1m webhook price</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end justify-between gap-2">
                  <p className="text-2xl font-semibold tracking-tight">{fmtNum(p.price, 2)}</p>
                  <Badge variant={toneByAge(ageMinutes(p.event_time_bkk), 3)}>{fmtDateTime(p.event_time_bkk)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  1m: {fmtNum(minuteAbs, 2)} ({fmtNum(minutePct, 2)}%)
                </p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>System Freshness</CardTitle>
            <CardDescription>Job health and stale data checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Relation age</span>
              <Badge variant={toneByAge(relationAge)}>{relationAge == null ? "-" : `${relationAge} min`}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CME age</span>
              <Badge variant={toneByAge(cmeAge)}>{cmeAge == null ? "-" : `${cmeAge} min`}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Relation job</span>
              <span>{jobsByName.get("relation_30m")?.status || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CME job</span>
              <span>{jobsByName.get("cme_30m")?.status || "-"}</span>
            </div>
            <div className="rounded-md border border-border bg-card/40 p-3 text-xs text-muted-foreground">
              Degraded symbols: {vm.relation?.quality_flags?.degraded_symbols?.join(", ") || "-"}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Relation Matrix (30m)</CardTitle>
            <CardDescription>Pair correlation, beta, spread, z-score, relative strength</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="table-shell">
              <Table>
                <THead>
                  <TR>
                    <TH>Pair</TH>
                    <TH>Corr</TH>
                    <TH>Beta</TH>
                    <TH>Spread</TH>
                    <TH>Z</TH>
                    <TH>Rel Strength</TH>
                  </TR>
                </THead>
                <TBody>
                  {(vm.relation?.pair_metrics || []).map((row: any) => (
                    <TR key={row.pair}>
                      <TD className="font-medium">{row.pair}</TD>
                      <TD>{fmtNum(row.correlation, 2)}</TD>
                      <TD>{fmtNum(row.beta, 2)}</TD>
                      <TD>{fmtNum(row.spread, 2)}</TD>
                      <TD>{fmtNum(row.z_score, 2)}</TD>
                      <TD>{fmtNum(row.relative_strength, 2)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CME OI/Intraday Latest</CardTitle>
            <CardDescription>Latest intraday + oi snapshots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="table-shell">
              <Table>
                <THead>
                  <TR>
                    <TH>Type</TH>
                    <TH>Series</TH>
                    <TH>Put</TH>
                    <TH>Call</TH>
                    <TH>XAU</TH>
                  </TR>
                </THead>
                <TBody>
                  {(vm.cmeSnapshots || []).map((row: any) => (
                    <TR key={row.id}>
                      <TD>{row.view_type}</TD>
                      <TD>
                        {row.series_name} ({row.series_expiration_date || "-"}, DTE {fmtNum(row.series_dte, 2)})
                      </TD>
                      <TD>{row.put_total ?? "-"}</TD>
                      <TD>{row.call_total ?? "-"}</TD>
                      <TD>{fmtNum(row.xauusd_price_at_snapshot, 2)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CME Top 3 Changes</CardTitle>
            <CardDescription>Latest compare only (now vs previous, same series)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!latestDeltas.length ? (
              <p className="text-sm text-muted-foreground">No CME delta snapshots yet.</p>
            ) : (
              latestDeltas.map((delta: any) => {
                const rows = (vm.cmeTopStrikeChanges || [])
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
                            <TH>Put Δ</TH>
                            <TH>Call Δ</TH>
                            <TH>Total Δ</TH>
                          </TR>
                        </THead>
                        <TBody>
                          {!rows.length ? (
                            <TR>
                              <TD colSpan={5}>No positive change rows.</TD>
                            </TR>
                          ) : (
                            rows.map((row: any) => (
                              <TR key={`${delta.id}-${row.rank}`}>
                                <TD>{row.rank}</TD>
                                <TD>{row.strike}</TD>
                                <TD>{fmtNum(row.put_change, 2)}</TD>
                                <TD>{fmtNum(row.call_change, 2)}</TD>
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
