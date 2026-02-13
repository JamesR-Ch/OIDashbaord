import { DashboardShell } from "./dashboard-shell";

export function AppShell({ children, status }: { children: React.ReactNode; status?: { relationAgeMin?: number | null; cmeAgeMin?: number | null } }) {
  return <DashboardShell status={status}>{children}</DashboardShell>;
}
