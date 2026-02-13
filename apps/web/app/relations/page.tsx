"use client";

import { TopNav } from "../../components/nav";
import { SectionCard } from "../../components/section";
import { useOverviewData } from "../../lib/use-overview-data";

export const dynamic = "force-dynamic";

export default function RelationsPage() {
  const { data, loading, error } = useOverviewData(15000);
  const relation = data?.relation;
  const fmt2 = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";

  return (
    <main className="container">
      <TopNav />
      {loading ? <p style={{ color: "var(--muted)", marginBottom: 10 }}>Loading data...</p> : null}
      {error ? <p className="badge-warn" style={{ marginBottom: 10 }}>Data load error: {error}</p> : null}
      <SectionCard title="Relations" subtitle="30-minute pair analytics">
        {!relation ? (
          <p>No relation data.</p>
        ) : (
          <>
            <p style={{ color: "var(--muted)" }}>Window: {new Date(relation.window_start_bkk).toLocaleString()} - {new Date(relation.window_end_bkk).toLocaleString()}</p>
            <p style={{ color: "var(--muted)", marginTop: 6 }}>
              Open symbols: {relation.quality_flags?.open_symbols?.length ? relation.quality_flags.open_symbols.join(", ") : "-"} | Closed symbols: {relation.quality_flags?.closed_symbols?.length ? relation.quality_flags.closed_symbols.join(", ") : "-"}
            </p>
            <h4 style={{ marginTop: 14 }}>Per Symbol</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Current</th>
                  <th>Previous</th>
                  <th>Abs</th>
                  <th>%</th>
                  <th>Points</th>
                  <th>Degraded</th>
                </tr>
              </thead>
              <tbody>
                {(relation.symbol_returns || []).map((row: any) => (
                  <tr key={row.symbol}>
                    <td>{row.symbol}</td>
                    <td>{fmt2(row.current_price)}</td>
                    <td>{fmt2(row.previous_price)}</td>
                    <td>{fmt2(row.abs_change)}</td>
                    <td>{fmt2(row.pct_change)}</td>
                    <td>{row.points_observed}</td>
                    <td>{row.degraded ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ marginTop: 14 }}>Pair Metrics</h4>
            <table className="table">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Corr</th>
                  <th>Beta</th>
                  <th>Spread</th>
                  <th>Z</th>
                  <th>Rel Strength</th>
                </tr>
              </thead>
              <tbody>
                {(relation.pair_metrics || []).map((row: any) => (
                  <tr key={row.pair}>
                    <td>{row.pair}</td>
                    <td>{fmt2(row.correlation)}</td>
                    <td>{fmt2(row.beta)}</td>
                    <td>{fmt2(row.spread)}</td>
                    <td>{fmt2(row.z_score)}</td>
                    <td>{fmt2(row.relative_strength)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </SectionCard>
    </main>
  );
}
