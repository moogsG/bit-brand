import * as React from "react";
import { cn } from "@/lib/utils";

export interface ColumnDef<TData> {
  key: string;
  header: string;
  className?: string;
  cell: (row: TData) => React.ReactNode;
}

interface DataTableProps<TData extends { id?: string }> {
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyMessage?: string;
  className?: string;
  getRowKey?: (row: TData, index: number) => string;
}

export function DataTable<TData extends { id?: string }>({
  columns,
  data,
  emptyMessage = "No results.",
  className,
  getRowKey,
}: DataTableProps<TData>) {
  return (
    <div className={cn("w-full overflow-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "h-10 px-4 text-left align-middle font-medium text-muted-foreground",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={getRowKey ? getRowKey(row, i) : (row.id ?? String(i))}
                className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 align-middle", col.className)}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
