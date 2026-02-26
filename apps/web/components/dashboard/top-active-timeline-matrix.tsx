import { fmtDateTimeShort } from "../../lib/format";
import { CmeSnapshotVM, CmeTopActiveVM } from "../../lib/view-models";
import { Table, TBody, TD, TH, THead, TR } from "../ui/table";

function renderViewMatrix(
  viewType: "intraday" | "oi",
  snapshots: CmeSnapshotVM[],
  topActives: CmeTopActiveVM[]
) {
  const byView = snapshots
    .filter((s) => s.view_type === viewType)
    .sort((a, b) => new Date(b.snapshot_time_bkk).getTime() - new Date(a.snapshot_time_bkk).getTime());
  const latestSeries = byView[0]?.series_name ?? null;
  const timeline = byView
    .filter((s) => (latestSeries ? s.series_name === latestSeries : true))
    .sort((a, b) => new Date(a.snapshot_time_bkk).getTime() - new Date(b.snapshot_time_bkk).getTime());
  const tableMinWidth = Math.max(1600, 220 + timeline.length * 320);

  const activeBySnapshot = new Map<string, CmeTopActiveVM[]>();
  for (const row of topActives) {
    const arr = activeBySnapshot.get(row.snapshot_id) || [];
    arr.push(row);
    activeBySnapshot.set(row.snapshot_id, arr);
  }

  const ranks = [1, 2, 3];

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-foreground/88">
        Type: {viewType === "intraday" ? "Intraday" : "OI"}{latestSeries ? ` · Series ${latestSeries}` : ""}
      </p>
      <div className="table-shell timeline-scroll w-full overflow-x-scroll pb-2">
        <Table className="w-max text-xs" style={{ minWidth: `${tableMinWidth}px` }}>
          <THead>
            <TR>
              <TH rowSpan={2} className="w-[72px] whitespace-nowrap">Rank</TH>
              {timeline.map((snap) => (
                <TH key={`time-${viewType}-${snap.id}`} colSpan={2} className="text-center whitespace-nowrap">
                  BKK Time: {fmtDateTimeShort(snap.snapshot_time_bkk)}
                </TH>
              ))}
            </TR>
            <TR>
              {timeline.map((snap) => (
                <TH
                  key={`sub-${viewType}-${snap.id}`}
                  colSpan={2}
                  className="border-b border-border px-3 py-2 text-left whitespace-nowrap"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <span>Strikes</span>
                    <span className="whitespace-nowrap">Put / Call / Total</span>
                  </div>
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {ranks.map((rank) => (
              <TR key={`rank-${viewType}-${rank}`}>
                <TD className="text-foreground/90">R{rank}</TD>
                {timeline.map((snap) => {
                  const item = (activeBySnapshot.get(snap.id) || []).find((row) => row.rank === rank);
                  return (
                    <TD key={`cell-${viewType}-${snap.id}-${rank}`} colSpan={2} className="border-border text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <span className="whitespace-nowrap">{item ? item.strike : "-"}</span>
                        {item ? (
                          <span className="whitespace-nowrap">
                            <span className="text-signal-down">{item.put}</span>
                            {" / "}
                            <span className="text-signal-up">{item.call}</span>
                            {" / "}
                            <strong className="font-semibold text-foreground">{item.total}</strong>
                          </span>
                        ) : (
                          <span className="whitespace-nowrap">-</span>
                        )}
                      </div>
                    </TD>
                  );
                })}
              </TR>
            ))}
            {timeline.length === 0 ? (
              <TR>
                <TD colSpan={1 + Math.max(1, timeline.length) * 2}>
                  No timeline rows for current {viewType} series.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

export function TopActiveTimelineMatrix({
  snapshots,
  topActives
}: {
  snapshots: CmeSnapshotVM[];
  topActives: CmeTopActiveVM[];
}) {
  return (
    <div className="space-y-4">
      {renderViewMatrix("intraday", snapshots, topActives)}
      {renderViewMatrix("oi", snapshots, topActives)}
    </div>
  );
}
