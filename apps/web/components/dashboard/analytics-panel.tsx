import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export function AnalyticsPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="bg-panel/95">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-foreground">{title}</CardTitle>
        {subtitle ? <CardDescription className="text-sm text-foreground/75">{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
