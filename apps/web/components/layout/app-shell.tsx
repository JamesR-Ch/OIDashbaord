import { TerminalShell } from "./terminal-shell";
import { DashboardMarketStatusVM } from "../../lib/view-models";

export function AppShell({
  children,
  status,
  marketStatus
}: {
  children: React.ReactNode;
  status?: { relationAgeMin?: number | null; cmeAgeMin?: number | null };
  marketStatus?: DashboardMarketStatusVM | null;
}) {
  return <TerminalShell status={status} marketStatus={marketStatus}>{children}</TerminalShell>;
}
