import { fmtNum, fmtSignedNum } from "../../lib/format";
import { StatusTone } from "../../lib/view-models";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { SignalChip } from "./signal-chip";
import { SparklineMini } from "./sparkline-mini";

interface KpiCardProps {
  symbol: string;
  price: number | null;
  digits?: number;
  changeAbs: number | null;
  changePct: number | null;
  eventTimeLabel: string;
  staleLabel: string;
  tone: StatusTone;
  sparklineValues: number[];
}

export function KpiCard({
  symbol,
  price,
  digits = 2,
  changeAbs,
  changePct,
  eventTimeLabel,
  staleLabel,
  tone,
  sparklineValues
}: KpiCardProps) {
  return (
    <Card className="surface-panel stagger-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.12em] text-foreground/72">{symbol}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="metric-xl">{fmtNum(price, digits)}</p>
          <SignalChip
            label={`${fmtSignedNum(changeAbs, 2)} (${fmtSignedNum(changePct, 2)}%)`}
            tone={tone}
          />
        </div>
        <SparklineMini values={sparklineValues} tone={tone} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{eventTimeLabel}</span>
          <span>{staleLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
