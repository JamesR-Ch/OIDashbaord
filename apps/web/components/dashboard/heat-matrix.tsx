import { HeatCell } from "./heat-cell";

export function HeatMatrix({
  symbols,
  valueAt
}: {
  symbols: string[];
  valueAt: (row: string, col: string) => number | null;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <div />
      {symbols.map((s) => (
        <div key={s} className="text-center text-[11px] text-muted-foreground">
          {s.replace("USD", "")}
        </div>
      ))}
      {symbols.map((row) => (
        <div key={row} className="contents">
          <div className="text-[11px] text-muted-foreground">{row.replace("USD", "")}</div>
          {symbols.map((col) => (
            <HeatCell key={`${row}-${col}`} value={valueAt(row, col)} isDiagonal={row === col} />
          ))}
        </div>
      ))}
    </div>
  );
}
