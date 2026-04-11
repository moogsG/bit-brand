"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface KeywordRecord {
  id: string;
  keyword: string;
  monthlyVolume: number | null;
  difficulty: number | null;
  intent: "INFORMATIONAL" | "NAVIGATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | null;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  currentPosition: number | null;
  targetPosition: number | null;
  targetUrl: string | null;
  notes: string | null;
  status: "OPPORTUNITY" | "TARGETING" | "RANKING" | "WON" | null;
}

interface KeywordFormDialogProps {
  clientId: string;
  editKeyword?: KeywordRecord;
  onSuccess?: () => void;
}

function blankState(editKeyword?: KeywordRecord) {
  return {
    keyword: editKeyword?.keyword ?? "",
    monthlyVolume: editKeyword?.monthlyVolume?.toString() ?? "",
    difficulty: editKeyword?.difficulty?.toString() ?? "",
    intent: (editKeyword?.intent ?? "") as string,
    priority: (editKeyword?.priority ?? "MEDIUM") as string,
    currentPosition: editKeyword?.currentPosition?.toString() ?? "",
    targetPosition: editKeyword?.targetPosition?.toString() ?? "",
    targetUrl: editKeyword?.targetUrl ?? "",
    notes: editKeyword?.notes ?? "",
    status: (editKeyword?.status ?? "OPPORTUNITY") as string,
  };
}

export function KeywordFormDialog({
  clientId,
  editKeyword,
  onSuccess,
}: KeywordFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(blankState(editKeyword));

  const isEdit = !!editKeyword;

  const set = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(blankState(editKeyword));
    setError(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetForm();
    setOpen(val);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.keyword.trim()) {
      setError("Keyword is required");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        clientId,
        keyword: form.keyword.trim(),
        monthlyVolume: form.monthlyVolume ? parseInt(form.monthlyVolume, 10) : null,
        difficulty: form.difficulty ? parseInt(form.difficulty, 10) : null,
        intent: form.intent || null,
        priority: form.priority || "MEDIUM",
        currentPosition: form.currentPosition ? parseInt(form.currentPosition, 10) : null,
        targetPosition: form.targetPosition ? parseInt(form.targetPosition, 10) : null,
        targetUrl: form.targetUrl || null,
        notes: form.notes || null,
        status: form.status || "OPPORTUNITY",
      };

      const url = isEdit ? `/api/keywords/${editKeyword.id}` : "/api/keywords";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to save keyword");
      }

      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button variant={isEdit ? "ghost" : "default"} size={isEdit ? "sm" : "default"} />}>
        {isEdit ? "Edit" : (
          <>
            <Plus className="h-4 w-4" />
            Add Keyword
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Keyword" : "Add Keyword"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="kw-keyword">Keyword *</Label>
            <Input
              id="kw-keyword"
              placeholder="e.g. brand anarchy seo"
              value={form.keyword}
              onChange={(e) => set("keyword", e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-volume">Monthly Volume</Label>
              <Input
                id="kw-volume"
                type="number"
                min="0"
                placeholder="e.g. 1200"
                value={form.monthlyVolume}
                onChange={(e) => set("monthlyVolume", e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-difficulty">Difficulty (0–100)</Label>
              <Input
                id="kw-difficulty"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 45"
                value={form.difficulty}
                onChange={(e) => set("difficulty", e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-intent">Intent</Label>
              <select
                id="kw-intent"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring"
                disabled={isLoading}
                value={form.intent}
                onChange={(e) => set("intent", e.target.value)}
              >
                <option value="">— Select —</option>
                <option value="INFORMATIONAL">Informational</option>
                <option value="NAVIGATIONAL">Navigational</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="TRANSACTIONAL">Transactional</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-priority">Priority</Label>
              <select
                id="kw-priority"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring"
                disabled={isLoading}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              >
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="kw-current-pos">Current Position</Label>
              <Input
                id="kw-current-pos"
                type="number"
                min="1"
                placeholder="e.g. 14"
                value={form.currentPosition}
                onChange={(e) => set("currentPosition", e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kw-target-pos">Target Position</Label>
              <Input
                id="kw-target-pos"
                type="number"
                min="1"
                placeholder="e.g. 3"
                value={form.targetPosition}
                onChange={(e) => set("targetPosition", e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kw-target-url">Target URL</Label>
            <Input
              id="kw-target-url"
              type="url"
              placeholder="https://example.com/page"
              value={form.targetUrl}
              onChange={(e) => set("targetUrl", e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kw-status">Status</Label>
            <select
              id="kw-status"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm focus-visible:outline-none focus-visible:border-ring"
              disabled={isLoading}
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="OPPORTUNITY">Opportunity</option>
              <option value="TARGETING">Targeting</option>
              <option value="RANKING">Ranking</option>
              <option value="WON">Won</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kw-notes">Notes</Label>
            <textarea
              id="kw-notes"
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring resize-none"
              disabled={isLoading}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : isEdit ? "Save Changes" : "Add Keyword"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
