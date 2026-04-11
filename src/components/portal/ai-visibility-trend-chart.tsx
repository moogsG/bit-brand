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

interface TrendData {
  date: string;
  overallScore: number | null;
}

interface AiVisibilityTrendChartProps {
  data: TrendData[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-sm text-sm space-y-1">
      <p className="font-medium text-xs text-muted-foreground">
        {label ? formatDate(label) : ""}
      </p>
      <p className="font-semibold">
        Score: {payload[0].value !== null ? Math.round(payload[0].value) : "—"}
      </p>
    </div>
  );
}

export function AiVisibilityTrendChart({ data }: AiVisibilityTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No trend data available yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: d.date,
    score: d.overallScore !== null ? Math.round(d.overallScore) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#8b5cf6"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
