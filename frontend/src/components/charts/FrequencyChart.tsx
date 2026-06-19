"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

interface FrequencyChartProps {
  data: DataPoint[];
  color?: string;
}

export function FrequencyChart({ data, color = "#8b5cf6" }: FrequencyChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          tickFormatter={(v) => v.slice(5)}
          className="text-muted-foreground"
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10 }}
          allowDecimals={false}
          width={25}
          className="text-muted-foreground"
        />
        <Tooltip
          formatter={(value: number) => [value, "workouts"]}
          labelFormatter={(label) => label}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
