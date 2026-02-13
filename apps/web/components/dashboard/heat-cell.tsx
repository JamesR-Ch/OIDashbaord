import { cn } from "../../lib/utils";
import { fmtNum } from "../../lib/format";

export function HeatCell({ value, isDiagonal = false }: { value: number | null; isDiagonal?: boolean }) {
  const v = typeof value === "number" && Number.isFinite(value) ? value : null;
  const abs = v == null ? 0 : Math.abs(v);
  const bucket = abs >= 0.8 ? 4 : abs >= 0.5 ? 3 : abs >= 0.25 ? 2 : abs >= 0.1 ? 1 : 0;

  const tone =
    v == null ? "bg-muted/25 text-muted-foreground" :
    v > 0 ? ["bg-success/10", "bg-success/20", "bg-success/30", "bg-success/40", "bg-success/50"][bucket] + " text-foreground" :
    v < 0 ? ["bg-danger/10", "bg-danger/20", "bg-danger/30", "bg-danger/40", "bg-danger/50"][bucket] + " text-foreground" :
    "bg-muted/30 text-signal-neutral";

  return (
    <div className={cn("rounded-md border border-border px-2 py-1 text-center text-xs", tone, isDiagonal && "font-semibold")}>{v == null ? "-" : fmtNum(v, 2)}</div>
  );
}
