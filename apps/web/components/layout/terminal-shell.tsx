import { DashboardShell } from "./dashboard-shell";
import { DashboardMarketStatusVM } from "../../lib/view-models";

export function TerminalShell({
  children,
  status,
  marketStatus
}: {
  children: React.ReactNode;
  status?: { relationAgeMin?: number | null; cmeAgeMin?: number | null };
  marketStatus?: DashboardMarketStatusVM | null;
}) {
  return <DashboardShell status={status} marketStatus={marketStatus}>{children}</DashboardShell>;
}
