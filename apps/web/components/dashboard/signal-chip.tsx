import { cn } from "../../lib/utils";

export type SignalTone = "up" | "down" | "neutral";

export function SignalChip({ label, tone }: { label: string; tone: SignalTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "up" && "border-success/50 bg-success/20 text-signal-up",
        tone === "down" && "border-danger/50 bg-danger/20 text-signal-down",
        tone === "neutral" && "border-border bg-muted/35 text-signal-neutral"
      )}
    >
      {label}
    </span>
  );
}
