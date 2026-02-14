import { cn } from "../../lib/utils";

type StateTone = "neutral" | "success" | "warning" | "danger";

const toneClass: Record<StateTone, string> = {
  neutral: "border-border bg-elevated/50 text-muted-foreground",
  success: "border-success/40 bg-success/15 text-signal-up",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
  danger: "border-danger/50 bg-danger/15 text-danger-foreground"
};

export function StateBlock({
  title,
  detail,
  tone = "neutral"
}: {
  title: string;
  detail?: string;
  tone?: StateTone;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs", toneClass[tone])}>
      <p className="font-medium">{title}</p>
      {detail ? <p className="mt-1 opacity-85">{detail}</p> : null}
    </div>
  );
}
