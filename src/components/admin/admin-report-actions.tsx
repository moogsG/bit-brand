"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface AdminReportActionsProps {
  clientId: string;
}

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AdminReportActions({ clientId }: AdminReportActionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          month: parseInt(month, 10),
          year: parseInt(year, 10),
        }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to create report");
      }
      const report = await res.json() as { id: string };
      setOpen(false);
      router.push(`/admin/clients/${clientId}/reports/${report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        Create Report
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Monthly Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="report-month">Month</Label>
              <select
                id="report-month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring"
                disabled={loading}
              >
                {MONTH_NAMES.slice(1).map((name, i) => {
                  const monthNum = i + 1;
                  return (
                    <option key={monthNum} value={String(monthNum)}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-year">Year</Label>
              <select
                id="report-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring"
                disabled={loading}
              >
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading}>
            {loading ? "Creating..." : "Create Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
