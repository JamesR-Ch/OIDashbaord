import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function AnalyticsPanel({
  title,
  subtitle,
  rightSlot,
  children
}: {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="surface-panel bg-panel/95">
      <CardHeader className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-[1.03rem] font-semibold tracking-tight text-foreground">{title}</CardTitle>
            {subtitle ? <CardDescription className="text-xs text-foreground/76">{subtitle}</CardDescription> : null}
          </div>
          {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
