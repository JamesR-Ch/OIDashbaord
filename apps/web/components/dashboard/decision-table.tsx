import { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Table, TBody, TD, TH, THead, TR } from "../ui/table";

export { TBody, TD, TH, THead, TR };

export function DecisionTable({
  children,
  compact = false
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="table-shell">
      <Table className={cn(compact ? "text-xs" : "text-sm")}>{children}</Table>
    </div>
  );
}
