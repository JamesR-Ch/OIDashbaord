export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/50 px-5 py-4 backdrop-blur-sm">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
