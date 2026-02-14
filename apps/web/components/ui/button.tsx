import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "secondary" | "ghost" | "danger";

type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/55",
  secondary:
    "bg-elevated/70 text-foreground border border-border hover:bg-elevated",
  ghost: "bg-transparent text-muted-foreground border border-border hover:text-foreground hover:bg-elevated/70",
  danger: "bg-danger text-danger-foreground border border-danger/80 hover:bg-danger/90"
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
});
