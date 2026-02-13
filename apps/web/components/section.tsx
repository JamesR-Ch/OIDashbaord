import { ReactNode } from "react";

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {subtitle ? <p style={{ color: "var(--muted)", marginTop: 6 }}>{subtitle}</p> : null}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}
