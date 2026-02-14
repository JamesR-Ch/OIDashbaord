export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-6 py-5">
      <h1 className="text-2xl font-semibold tracking-tight md:text-[1.9rem]">{title}</h1>
      <p className="mt-1.5 text-sm text-foreground/75">{subtitle}</p>
    </div>
  );
}
