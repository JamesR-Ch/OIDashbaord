import { ReactNode } from "react";
import { TopNav } from "./top-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_8%,hsl(var(--primary)/0.22),transparent_30%),radial-gradient(circle_at_86%_12%,hsl(var(--accent)/0.25),transparent_28%),linear-gradient(160deg,hsl(var(--background)),hsl(var(--background-2)))]" />
      <div className="container py-5 md:py-8">
        <TopNav />
        <div className="mt-5 space-y-4">{children}</div>
      </div>
    </main>
  );
}
