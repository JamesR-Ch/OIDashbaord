import { TopNav } from "../../components/nav";
import { SectionCard } from "../../components/section";

export const dynamic = "force-dynamic";

async function getOverview() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/dashboard/overview-public`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function OverviewPage() {
  const data = await getOverview();
  const prices = data?.prices || [];
  const relation = data?.relation;
  const cme = data?.cme_snapshots || [];
  const cmeDeltas = data?.cme_deltas || [];
  const cmeTopStrikeChanges = data?.cme_top_strike_changes || [];
  const jobs = data?.jobs || [];
  const sortedDeltas = [...cmeDeltas].sort(
    (a: any, b: any) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime()
  );
  const latestDeltaByView = new Map<string, any>();
  for (const row of sortedDeltas) {
    if (!latestDeltaByView.has(row.view_type)) {
      latestDeltaByView.set(row.view_type, row);
    }
  }
  const latestDeltas = Array.from(latestDeltaByView.values());

  const latestByJob = new Map<string, any>();
  for (const job of jobs) {
    if (!latestByJob.has(job.job_name)) latestByJob.set(job.job_name, job);
  }

  const nowMs = Date.now();
  function ageMinutes(iso?: string | null) {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.round((nowMs - ms) / 60000));
  }
  function staleClass(minutes: number | null, threshold = 3) {
    if (minutes == null) return "";
    return minutes > threshold ? "badge-warn" : "badge-ok";
  }

  const relationAge = ageMinutes(relation?.anchor_time_bkk);
  const latestCme = cme[0] || null;
  const cmeAge = ageMinutes(latestCme?.snapshot_time_bkk);
  const relationRun = latestByJob.get("relation_30m");
  const cmeRun = latestByJob.get("cme_30m");
  const cmeRunDuration =
    typeof cmeRun?.metadata?.duration_ms === "number" ? `${cmeRun.metadata.duration_ms} ms` : null;
  const fmt2 = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";

  return (
    <main className="container">
      <TopNav />

      <div className="grid cols-3">
        {prices.map((p: {
          symbol: string;
          price: number;
          event_time_bkk: string;
          minute_abs_change?: number | null;
          minute_pct_change?: number | null;
        }) => {
          const age = ageMinutes(p.event_time_bkk);
          const rel = (relation?.symbol_returns || []).find((row: any) => row.symbol === p.symbol);
          const minuteAbs = typeof p.minute_abs_change === "number" ? p.minute_abs_change : rel?.minute_abs_change;
          const minutePct = typeof p.minute_pct_change === "number" ? p.minute_pct_change : rel?.minute_pct_change;
          return (
          <SectionCard key={p.symbol} title={p.symbol} subtitle="Latest 1m webhook price">
            <div className="metric">
              <strong>{p.price.toLocaleString()}</strong>
              <span className="tag">{new Date(p.event_time_bkk).toLocaleTimeString()}</span>
            </div>
            <p style={{ marginTop: 6, color: "var(--muted)" }}>
              1m: {typeof minuteAbs === "number" ? minuteAbs.toFixed(4) : "-"} ({typeof minutePct === "number" ? minutePct.toFixed(4) : "-"}%)
            </p>
            <p style={{ marginTop: 6 }} className={staleClass(age, 3)}>
              {age == null ? "age unavailable" : `${age} min ago`}
            </p>
          </SectionCard>
        )})}
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <SectionCard title="System Freshness" subtitle="Run health and data staleness">
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Latest relation snapshot age</td>
                <td className={staleClass(relationAge, 35)}>{relationAge == null ? "-" : `${relationAge} min`}</td>
              </tr>
              <tr>
                <td>Latest CME snapshot age</td>
                <td className={staleClass(cmeAge, 35)}>{cmeAge == null ? "-" : `${cmeAge} min`}</td>
              </tr>
              <tr>
                <td>Relation job status</td>
                <td>{relationRun?.status || "-"}</td>
              </tr>
              <tr>
                <td>CME job status</td>
                <td>{cmeRun?.status || "-"}</td>
              </tr>
              <tr>
                <td>CME job detail</td>
                <td>{cmeRun?.error_message || cmeRun?.metadata?.reason || cmeRunDuration || "-"}</td>
              </tr>
              <tr>
                <td>Relation open symbols</td>
                <td>
                  {relation?.quality_flags?.open_symbols?.length
                    ? relation.quality_flags.open_symbols.join(", ")
                    : "-"}
                </td>
              </tr>
              <tr>
                <td>Relation closed symbols</td>
                <td>
                  {relation?.quality_flags?.closed_symbols?.length
                    ? relation.quality_flags.closed_symbols.join(", ")
                    : "-"}
                </td>
              </tr>
              <tr>
                <td>Relation degraded symbols</td>
                <td>
                  {relation?.quality_flags?.degraded_symbols?.length
                    ? relation.quality_flags.degraded_symbols.join(", ")
                    : "-"}
                </td>
              </tr>
              <tr>
                <td>Relation pair aligned points</td>
                <td>
                  {relation?.quality_flags?.pair_aligned_points?.length
                    ? relation.quality_flags.pair_aligned_points.join(", ")
                    : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Relation Snapshot" subtitle="30-minute engine output">
          {relation ? (
            <>
              <p style={{ color: "var(--muted)" }}>Anchor: {new Date(relation.anchor_time_bkk).toLocaleString()}</p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Corr</th>
                    <th>Beta</th>
                    <th>Spread</th>
                    <th>Z-Score</th>
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
          ) : (
            <p>No relation snapshot yet.</p>
          )}
        </SectionCard>

        <SectionCard title="CME OI/Intraday" subtitle="Latest two snapshots with Top 3 actives">
          {cme.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Series</th>
                  <th>Put</th>
                  <th>Call</th>
                  <th>XAU</th>
                </tr>
              </thead>
              <tbody>
                {cme.map((row: any) => (
                  <tr key={row.id}>
                    <td>{row.view_type}</td>
                    <td>{row.series_name} ({row.series_expiration_date || "-"}, DTE {typeof row.series_dte === "number" ? row.series_dte.toFixed(2) : "-"})</td>
                    <td>{row.put_total}</td>
                    <td>{row.call_total}</td>
                    <td>{row.xauusd_price_at_snapshot ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No CME snapshots yet.</p>
          )}
        </SectionCard>

        <SectionCard title="CME Change Snapshot" subtitle="Latest previous vs current change by view">
          {!latestDeltas.length ? (
            <p>No CME change deltas yet.</p>
          ) : (
            latestDeltas.map((delta: any) => {
              const rows = cmeTopStrikeChanges
                .filter((row: any) => row.delta_id === delta.id)
                .sort((a: any, b: any) => a.rank - b.rank);
              return (
                <div key={delta.id} style={{ marginBottom: 12 }}>
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
                        <th>Total Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No positive strike changes for this compare.</td>
                        </tr>
                      ) : (
                        rows.map((row: any) => (
                          <tr key={`${delta.id}-${row.rank}`}>
                            <td>{row.rank}</td>
                            <td>{row.strike}</td>
                            <td>{row.put_before} → {row.put_now} ({row.put_change})</td>
                            <td>{row.call_before} → {row.call_now} ({row.call_change})</td>
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
      </div>
    </main>
  );
}
