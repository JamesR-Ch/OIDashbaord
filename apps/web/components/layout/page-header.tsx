export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 rounded-xl border border-border bg-panel px-6 py-5">
      <h1 className="text-[1.9rem] font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-foreground/76">{subtitle}</p>
    </div>
  );
}
