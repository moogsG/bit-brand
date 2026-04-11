import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  loading?: boolean;
  noData?: boolean;
  lowerIsBetter?: boolean;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = "vs last 30 days",
  icon,
  loading = false,
  noData = false,
  lowerIsBetter = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (noData) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <div className="text-muted-foreground">{icon}</div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data yet — connect your data sources
          </p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  // For metrics like position where lower is better, flip the color logic
  const showGreen = lowerIsBetter ? isNegative : isPositive;
  const showRed = lowerIsBetter ? isPositive : isNegative;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p
            className={cn(
              "text-xs flex items-center gap-1 mt-1",
              showGreen && "text-emerald-600",
              showRed && "text-red-500",
              isNeutral && "text-muted-foreground"
            )}
          >
            {showGreen && <TrendingUp className="h-3 w-3" />}
            {showRed && <TrendingDown className="h-3 w-3" />}
            {isNeutral && !lowerIsBetter && <Minus className="h-3 w-3" />}
            <span>
              {change > 0 ? "+" : ""}
              {change.toFixed(1)}% {changeLabel}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
