import { ReactNode } from "react";
import { Table, TBody, TD, TH, THead, TR } from "../ui/table";

export { TBody, TD, TH, THead, TR };

export function CompactTable({ children }: { children: ReactNode }) {
  return (
    <div className="table-shell">
      <Table>{children}</Table>
    </div>
  );
}
