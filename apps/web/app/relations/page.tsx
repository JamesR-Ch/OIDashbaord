"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "../../components/ui/table";
import { ErrorState, LoadingState } from "../../components/dashboard/states";
import { useOverviewData } from "../../lib/use-overview-data";
import { fmtDateTime, fmtNum } from "../../lib/format";
import { toRelationsViewModel } from "../../lib/view-models";

export const dynamic = "force-dynamic";

export default function RelationsPage() {
  const { data, loading, error } = useOverviewData(15000);
  const vm = toRelationsViewModel(data);

  return (
    <AppShell>
      <PageHeader
        title="Relations"
        subtitle="30-minute quantitative relation engine for XAUUSD, THBUSD, and BTCUSD."
      />

      {loading ? <LoadingState title="Loading relations" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!vm.relation ? (
        <Card>
          <CardHeader>
            <CardTitle>No relation data</CardTitle>
            <CardDescription>Run relation job or wait for scheduled execution.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Relation Window</CardTitle>
              <CardDescription>
                {fmtDateTime(vm.relation.window_start_bkk)} - {fmtDateTime(vm.relation.window_end_bkk)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="success">Open: {(vm.relation.quality_flags?.open_symbols || []).join(", ") || "-"}</Badge>
              <Badge variant="warning">Closed: {(vm.relation.quality_flags?.closed_symbols || []).join(", ") || "-"}</Badge>
              <Badge variant="outline">Degraded: {(vm.relation.quality_flags?.degraded_symbols || []).join(", ") || "-"}</Badge>
              <Badge variant="outline">Aligned: {(vm.relation.quality_flags?.pair_aligned_points || []).join(", ") || "-"}</Badge>
            </CardContent>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Per Symbol (30m)</CardTitle>
                <CardDescription>Current, previous, abs change, pct change, points, degraded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="table-shell">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Symbol</TH>
                        <TH>Current</TH>
                        <TH>Previous</TH>
                        <TH>Abs</TH>
                        <TH>%</TH>
                        <TH>Points</TH>
                        <TH>Degraded</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {(vm.relation.symbol_returns || []).map((row: any) => (
                        <TR key={row.symbol}>
                          <TD className="font-medium">{row.symbol}</TD>
                          <TD>{fmtNum(row.current_price, 2)}</TD>
                          <TD>{fmtNum(row.previous_price, 2)}</TD>
                          <TD>{fmtNum(row.abs_change, 2)}</TD>
                          <TD>{fmtNum(row.pct_change, 2)}</TD>
                          <TD>{row.points_observed ?? "-"}</TD>
                          <TD>{row.degraded ? "yes" : "no"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pair Metrics (30m)</CardTitle>
                <CardDescription>Corr, beta, spread, z-score, relative strength</CardDescription>
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
                      {(vm.relation.pair_metrics || []).map((row: any) => (
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
        </>
      )}
    </AppShell>
  );
}
