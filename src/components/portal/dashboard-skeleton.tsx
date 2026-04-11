import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function KpiCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full rounded-md" style={{ height }} />
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
      <Skeleton className="h-4 w-48 flex-shrink-0" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>

      {/* 2 charts side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="p-0">
          {["r1","r2","r3","r4","r5","r6","r7","r8"].map((k) => (
            <TableRowSkeleton key={k} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function KeywordsSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-12 w-16" />
          <Skeleton className="h-12 w-16" />
          <Skeleton className="h-12 w-16" />
        </div>
      </div>

      {/* Filters row */}
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="h-10 px-4 border-b border-border flex items-center gap-6">
            {["Keyword", "Volume", "Difficulty", "Intent", "Priority", "Position", "Target", "Status"].map((col) => (
              <Skeleton key={col} className="h-3 w-16" />
            ))}
          </div>
          {["k1","k2","k3","k4","k5","k6","k7","k8","k9","k10"].map((k) => (
            <div key={k} className="flex items-center gap-6 px-4 py-3 border-b border-border last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-5 w-18 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportsListSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-60" />
      </div>
      <div className="space-y-4">
        {["rep1","rep2","rep3","rep4","rep5","rep6"].map((k) => (
          <Card key={k}>
            <CardContent className="py-4 px-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="h-10 px-4 border-b border-border bg-muted/40" />
          {Array.from({ length: rows }, (_, i) => `row-${i}`).map((k) => (
            <div key={k} className="flex items-center gap-6 px-4 py-3 border-b border-border last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
