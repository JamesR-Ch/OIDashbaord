"use client";

import { AppShell } from "../../components/layout/app-shell";
import { PageHeader } from "../../components/layout/page-header";
import { AnalyticsPanel } from "../../components/dashboard/analytics-panel";
import { SignalChip } from "../../components/dashboard/signal-chip";

export default function RelationsPage() {
  return (
    <AppShell>
      <PageHeader title="Relations" subtitle="This page is temporarily disabled while we redesign relation analytics." />

      <div className="space-y-6 md:space-y-7">
        <AnalyticsPanel
          title="Coming Soon"
          subtitle="Relation visualizations will return in a cleaner format."
          rightSlot={<SignalChip label="Planned" tone="neutral" />}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>We are rebuilding this page with improved signal hierarchy and interaction design.</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>New relation matrix and pair signal cards</li>
              <li>Better metric readability and interpretation labels</li>
              <li>Mobile-friendly layout and table behavior</li>
            </ul>
          </div>
        </AnalyticsPanel>
      </div>
    </AppShell>
  );
}
