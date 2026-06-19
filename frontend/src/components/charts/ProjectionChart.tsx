"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface ProjectionPoint {
  date: string;
  actual_weight: number | null;
  projected_weight: number | null;
  target_weight: number | null;
}

interface Props {
  data: ProjectionPoint[];
  labels: { actual: string; projected: string; target: string };
  unit?: string;
}

export function ProjectionChart({ data, labels, unit = " kg" }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        —
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.slice(5)}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10 }}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => `${v}${unit}`}
          width={48}
        />
        <Tooltip
          formatter={(value: number, name: string) => [`${value}${unit}`, name]}
          labelFormatter={(label: string) => label}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{value}</span>
          )}
        />
        <ReferenceLine
          x={todayStr}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="4 2"
          strokeWidth={1}
        />
        <Line
          type="monotone"
          dataKey="actual_weight"
          name={labels.actual}
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 2, fill: "#3b82f6" }}
          activeDot={{ r: 4 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="projected_weight"
          name={labels.projected}
          stroke="#a855f7"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="target_weight"
          name={labels.target}
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
