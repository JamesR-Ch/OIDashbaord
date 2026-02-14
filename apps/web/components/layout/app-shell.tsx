import { TerminalShell } from "./terminal-shell";

export function AppShell({ children, status }: { children: React.ReactNode; status?: { relationAgeMin?: number | null; cmeAgeMin?: number | null } }) {
  return <TerminalShell status={status}>{children}</TerminalShell>;
}
