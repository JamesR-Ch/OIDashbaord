import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { SignalChip, SignalTone } from "./signal-chip";

export function MetricCard({
  title,
  value,
  subtitle,
  signal
}: {
  title: string;
  value: string;
  subtitle?: string;
  signal?: { label: string; tone: SignalTone };
}) {
  return (
    <Card className="bg-panel/85">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <p className="metric-lg">{value}</p>
          {signal ? <SignalChip label={signal.label} tone={signal.tone} /> : null}
        </div>
        {subtitle ? <CardDescription className="mt-1">{subtitle}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
