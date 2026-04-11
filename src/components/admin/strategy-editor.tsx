"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Globe } from "lucide-react";

interface Section {
  id: string;
  title: string;
  content: string;
  order: number;
}

interface StrategyEditorProps {
  strategyId: string;
  clientId: string;
  initialTitle: string;
  initialSections: Section[];
  initialStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export function StrategyEditor({
  strategyId,
  initialTitle,
  initialSections,
  initialStatus,
}: StrategyEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [sections, setSections] = useState<Section[]>(
    [...initialSections].sort((a, b) => a.order - b.order)
  );
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(
    async (newTitle: string, newSections: Section[], newStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      try {
        const res = await fetch(`/api/strategies/${strategyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle,
            sections: newSections,
            status: newStatus,
          }),
        });
        if (!res.ok) {
          const json = await res.json() as { error?: string };
          throw new Error(json.error ?? "Save failed");
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [strategyId]
  );

  const debouncedSave = useCallback(
    (newTitle: string, newSections: Section[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        save(newTitle, newSections, status);
      }, 1500);
    },
    [save, status]
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    debouncedSave(val, sections);
  };

  const handleSectionChange = (id: string, content: string) => {
    const updated = sections.map((s) => (s.id === id ? { ...s, content } : s));
    setSections(updated);
    debouncedSave(title, updated);
  };

  const handleSave = async (newStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED") => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus(newStatus);
    await save(title, sections, newStatus);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Save status bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            status === "PUBLISHED"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : status === "ARCHIVED"
              ? "bg-gray-100 text-gray-600"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
          }`}>
            {status}
          </span>
          {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
          {saveSuccess && <span className="text-xs text-green-600">Saved!</span>}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => handleSave("DRAFT")}
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => handleSave("PUBLISHED")}
          >
            <Globe className="h-3.5 w-3.5" />
            {status === "PUBLISHED" ? "Update Published" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="strategy-title">Strategy Title</Label>
        <Input
          id="strategy-title"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-lg font-semibold"
          placeholder="e.g. Q1 2025 SEO Strategy"
        />
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {section.order}. {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={section.content}
                onChange={(e) => handleSectionChange(section.id, e.target.value)}
                onBlur={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  save(title, sections, status);
                }}
                rows={6}
                placeholder={`Write the ${section.title} content here...`}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring resize-y min-h-24"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom save bar */}
      <div className="flex items-center justify-end gap-2 pb-6">
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => handleSave("DRAFT")}
        >
          <Save className="h-4 w-4" />
          Save Draft
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={() => handleSave("PUBLISHED")}
        >
          <Globe className="h-4 w-4" />
          {status === "PUBLISHED" ? "Update Published" : "Publish Strategy"}
        </Button>
      </div>
    </div>
  );
}
