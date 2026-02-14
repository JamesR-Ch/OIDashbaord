export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2 rounded-xl border border-border bg-panel px-7 py-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[1.9rem]">{title}</h1>
      <p className="mt-2 text-sm text-foreground/80">{subtitle}</p>
    </div>
  );
}
