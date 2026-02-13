"use client";

import { TopNav } from "../../components/nav";
import { SectionCard } from "../../components/section";
import { useOverviewData } from "../../lib/use-overview-data";

export const dynamic = "force-dynamic";

export default function CmePage() {
  const { data, loading, error } = useOverviewData(15000);
  const cme = data?.cme_snapshots || [];
  const topActives = data?.top_actives || [];
  const deltas = data?.cme_deltas || [];
  const topStrikeChanges = data?.cme_top_strike_changes || [];
  const snapshotById = new Map<string, any>(cme.map((row: any) => [row.id, row]));
  const topBySnapshot = new Map<string, any[]>();
  for (const row of topActives) {
    const arr = topBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    topBySnapshot.set(row.snapshot_id, arr);
  }
  const sortedSnapshots = [...cme].sort(
    (a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime()
  );
  const sortedDeltas = [...deltas].sort(
    (a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime()
  );
  const latestDeltaByView = new Map<string, any>();
  for (const row of sortedDeltas) {
    if (!latestDeltaByView.has(row.view_type)) {
      latestDeltaByView.set(row.view_type, row);
    }
  }
  const latestDeltas = Array.from(latestDeltaByView.values());

  return (
    <main className="container">
      <TopNav />
      {loading ? <p style={{ color: "var(--muted)", marginBottom: 10 }}>Loading data...</p> : null}
      {error ? <p className="badge-warn" style={{ marginBottom: 10 }}>Data load error: {error}</p> : null}
      <SectionCard title="CME Detail" subtitle="OI and Intraday with top strikes">
        <table className="table">
          <thead>
            <tr>
              <th>Time (BKK)</th>
              <th>Type</th>
              <th>Series</th>
              <th>Exp Date</th>
              <th>DTE</th>
              <th>Put</th>
              <th>Call</th>
              <th>Vol</th>
              <th>Vol Chg</th>
              <th>Fut Chg</th>
            </tr>
          </thead>
          <tbody>
            {cme.map((row: any) => (
              <tr key={row.id}>
                <td>{new Date(row.snapshot_time_bkk).toLocaleString()}</td>
                <td>{row.view_type}</td>
                <td>{row.series_name}</td>
                <td>{row.series_expiration_date || "-"}</td>
                <td>{typeof row.series_dte === "number" ? row.series_dte.toFixed(2) : "-"}</td>
                <td>{row.put_total}</td>
                <td>{row.call_total}</td>
                <td>{row.vol}</td>
                <td>{row.vol_chg}</td>
                <td>{row.future_chg}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 style={{ marginTop: 20 }}>Top 3 Active Strikes by View</h4>
        {sortedSnapshots.map((snapshot: any) => {
          const rows = (topBySnapshot.get(snapshot.id) || []).sort((a, b) => a.rank - b.rank);
          return (
            <div key={snapshot.id} style={{ marginTop: 14 }}>
              <p style={{ color: "var(--muted)" }}>
                {snapshot.view_type.toUpperCase()} | {new Date(snapshot.snapshot_time_bkk).toLocaleString()} | {snapshot.series_name} | {snapshot.series_expiration_date || "-"} | DTE {typeof snapshot.series_dte === "number" ? snapshot.series_dte.toFixed(2) : "-"}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Strike</th>
                    <th>Put</th>
                    <th>Call</th>
                    <th>Total</th>
                    <th>Vol Settle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, idx: number) => (
                    <tr key={`${snapshot.id}-${row.rank}-${idx}`}>
                      <td>{row.rank}</td>
                      <td>{row.strike}</td>
                      <td>{row.put}</td>
                      <td>{row.call}</td>
                      <td>{row.total}</td>
                      <td>{typeof row.vol_settle === "number" ? row.vol_settle.toFixed(2) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <h4 style={{ marginTop: 20 }}>Top 3 Strike Changes (Previous vs Current)</h4>
        {latestDeltas.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No delta data yet.</p>
        ) : (
          latestDeltas.map((delta: any) => {
            const rows = topStrikeChanges
              .filter((row: any) => row.delta_id === delta.id)
              .sort((a: any, b: any) => a.rank - b.rank);
            return (
              <div key={delta.id} style={{ marginTop: 14 }}>
                <p style={{ color: "var(--muted)" }}>
                  {delta.view_type.toUpperCase()} | {delta.series_name}
                </p>
                <p style={{ marginTop: 4 }}>
                  Compare time: {new Date(delta.snapshot_time_bkk).toLocaleString()} vs{" "}
                  {delta.previous_snapshot_time_bkk ? new Date(delta.previous_snapshot_time_bkk).toLocaleString() : "-"}
                </p>
                <p style={{ marginTop: 4 }}>
                  Put Δ {delta.put_change} | Call Δ {delta.call_change} | Vol Δ {delta.vol_change ?? "-"} | Fut Δ {delta.future_change ?? "-"}
                </p>
                <table className="table" style={{ marginTop: 6 }}>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Strike</th>
                      <th>Put (Prev→Now)</th>
                      <th>Call (Prev→Now)</th>
                      <th>Total (Prev→Now)</th>
                      <th>Total Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6}>No positive strike changes for this compare.</td>
                      </tr>
                    ) : (
                      rows.map((row: any) => (
                        <tr key={`${delta.id}-${row.rank}`}>
                          <td>{row.rank}</td>
                          <td>{row.strike}</td>
                          <td>{row.put_before} → {row.put_now} ({row.put_change})</td>
                          <td>{row.call_before} → {row.call_now} ({row.call_change})</td>
                          <td>{row.total_before} → {row.total_now}</td>
                          <td>{row.total_change}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </SectionCard>
    </main>
  );
}
