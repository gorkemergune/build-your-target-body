"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  value: number | null;
}

interface TrendChartProps {
  data: DataPoint[];
  color?: string;
  unit?: string;
}

export function TrendChart({ data, color = "#3b82f6", unit = "" }: TrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => v.slice(5)}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          domain={["auto", "auto"]}
          tickFormatter={(v) => `${v}${unit}`}
          className="text-muted-foreground"
          width={45}
        />
        <Tooltip
          formatter={(value: number) => [`${value}${unit}`, ""]}
          labelFormatter={(label) => label}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
