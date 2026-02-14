import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function AnalyticsPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="bg-panel/95">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-lg font-semibold tracking-tight text-foreground">{title}</CardTitle>
        {subtitle ? <CardDescription className="text-sm text-foreground/80">{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
