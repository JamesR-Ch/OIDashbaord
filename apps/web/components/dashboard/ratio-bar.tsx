import { fmtNum } from "../../lib/format";

export function RatioBar({
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  tone,
  pcr
}: {
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  tone: "up" | "down" | "neutral";
  pcr?: number | null;
}) {
  const total = Math.max(0, leftValue) + Math.max(0, rightValue);
  const leftPct = total > 0 ? (Math.max(0, leftValue) / total) * 100 : 50;
  const rightPct = 100 - leftPct;
  const ratio = pcr === undefined ? (rightValue === 0 ? Number.POSITIVE_INFINITY : leftValue / rightValue) : pcr;
  const ratioLabel = ratio == null ? "-" : Number.isFinite(ratio) ? fmtNum(ratio, 2) : "∞";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-signal-down">{leftLabel} {fmtNum(leftValue, 2)}</span>
        <span className={tone === "up" ? "text-signal-up" : tone === "down" ? "text-signal-down" : "text-signal-neutral"}>
          PCR {ratioLabel}
        </span>
        <span className="text-signal-up">{rightLabel} {fmtNum(rightValue, 2)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full border border-border bg-muted/35">
        <div className="flex h-full w-full">
          <div className="h-full bg-danger/85" style={{ width: `${leftPct}%` }} />
          <div className="h-full bg-success/85" style={{ width: `${rightPct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{fmtNum(leftPct, 1)}%</span>
        <span>{fmtNum(rightPct, 1)}%</span>
      </div>
    </div>
  );
}
