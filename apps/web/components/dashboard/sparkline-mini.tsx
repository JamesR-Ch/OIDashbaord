"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { StatusTone } from "../../lib/view-models";

interface SparklineMiniProps {
  values: number[];
  tone: StatusTone;
}

export function SparklineMini({ values, tone }: SparklineMiniProps) {
  const cleaned = values
    .filter((v) => Number.isFinite(v))
    .slice(-12)
    .map((v, i) => ({ x: i, y: v }));

  if (cleaned.length < 2) {
    return <div className="h-12 w-full rounded-md border border-border bg-elevated/40" />;
  }

  const stroke = tone === "up" ? "hsl(var(--signal-up))" : tone === "down" ? "hsl(var(--signal-down))" : "hsl(var(--signal-neutral))";
  const fill = tone === "up" ? "rgba(22, 163, 74, 0.22)" : tone === "down" ? "rgba(220, 38, 38, 0.2)" : "rgba(148, 163, 184, 0.2)";

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={cleaned} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={1.6}
            fill={fill}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
