import { cn } from "../../lib/utils";

export function PageSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("terminal-grid", className)}>{children}</section>;
}
