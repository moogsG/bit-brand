import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KeywordRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
}

interface TopKeywordsTableProps {
  keywords: KeywordRow[];
}

function positionColor(position: number | null): string {
  if (position === null) return "text-muted-foreground";
  if (position <= 3) return "text-emerald-600 font-semibold";
  if (position <= 10) return "text-amber-500 font-medium";
  return "text-muted-foreground";
}

export function TopKeywordsTable({ keywords }: TopKeywordsTableProps) {
  if (!keywords || keywords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Top Keywords by Clicks
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-sm text-muted-foreground">
            No data yet — connect your data sources
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...keywords]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Top Keywords by Clicks
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-4 font-medium text-muted-foreground">
                  Keyword
                </th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                  Clicks
                </th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                  Impressions
                </th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                  CTR
                </th>
                <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                  Position
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kw, i) => (
                <tr
                  key={kw.query}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2 px-4 font-medium truncate max-w-[200px]">
                    {kw.query}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {kw.clicks.toLocaleString()}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {kw.impressions.toLocaleString()}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {kw.ctr !== null
                      ? `${(kw.ctr * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      "py-2 px-4 text-right",
                      positionColor(kw.position)
                    )}
                  >
                    {kw.position !== null ? kw.position.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
