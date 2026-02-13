import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "success" | "warning" | "outline";

const variantClass: Record<Variant, string> = {
  default: "border-primary/40 bg-primary/20 text-primary-foreground",
  success: "border-success/40 bg-success/20 text-success-foreground",
  warning: "border-warning/40 bg-warning/20 text-warning-foreground",
  outline: "border-border bg-card/40 text-muted-foreground"
};

export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", variantClass[variant], className)} {...props} />
  );
}
