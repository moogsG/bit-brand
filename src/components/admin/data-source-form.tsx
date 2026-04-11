"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DataSource } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, Link as LinkIcon, Unlink } from "lucide-react";

type DataSourceType = "GA4" | "GSC" | "AHREFS" | "RANKSCALE" | "SEMRUSH";

const DATA_SOURCE_META: Record<
  DataSourceType,
  {
    label: string;
    description: string;
    fieldType: "propertyId" | "siteUrl" | "apiKey";
    fieldLabel: string;
    fieldPlaceholder: string;
  }
> = {
  GA4: {
    label: "Google Analytics 4",
    description: "Connect your GA4 property for traffic data.",
    fieldType: "propertyId",
    fieldLabel: "GA4 Property ID",
    fieldPlaceholder: "123456789",
  },
  GSC: {
    label: "Google Search Console",
    description: "Connect GSC for organic search performance data.",
    fieldType: "siteUrl",
    fieldLabel: "Site URL",
    fieldPlaceholder: "https://example.com/",
  },
  AHREFS: {
    label: "Ahrefs",
    description: "Connect Ahrefs for backlink and keyword data.",
    fieldType: "apiKey",
    fieldLabel: "API Key",
    fieldPlaceholder: "ahrefs_api_key_here",
  },
  RANKSCALE: {
    label: "RankScale",
    description: "Connect RankScale for AI visibility tracking.",
    fieldType: "apiKey",
    fieldLabel: "API Key",
    fieldPlaceholder: "rankscale_api_key_here",
  },
  SEMRUSH: {
    label: "SEMrush",
    description: "Connect SEMrush for competitive intelligence.",
    fieldType: "apiKey",
    fieldLabel: "API Key",
    fieldPlaceholder: "semrush_api_key_here",
  },
};

interface DataSourceCardProps {
  clientId: string;
  type: DataSourceType;
  existing?: DataSource;
}

function DataSourceCard({ clientId, type, existing }: DataSourceCardProps) {
  const router = useRouter();
  const meta = DATA_SOURCE_META[type];

  const getInitialValue = () => {
    if (!existing) return "";
    if (meta.fieldType === "propertyId") return existing.propertyId ?? "";
    if (meta.fieldType === "siteUrl") return existing.siteUrl ?? "";
    return existing.credentialsEnc ?? "";
  };

  const [value, setValue] = useState(getInitialValue());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isConnected = existing?.isConnected ?? false;

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = {
        type,
        isConnected: value.trim().length > 0,
      };
      if (meta.fieldType === "propertyId") payload.propertyId = value.trim() || null;
      else if (meta.fieldType === "siteUrl") payload.siteUrl = value.trim() || null;
      else payload.credentialsEnc = value.trim() || null;

      const res = await fetch(`/api/clients/${clientId}/data-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? "Failed to save");
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        type,
        isConnected: false,
      };
      if (meta.fieldType === "propertyId") payload.propertyId = null;
      else if (meta.fieldType === "siteUrl") payload.siteUrl = null;
      else payload.credentialsEnc = null;

      const res = await fetch(`/api/clients/${clientId}/data-sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      setValue("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-base">{meta.label}</CardTitle>
          </div>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isConnected
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && <p className="text-xs text-green-600">Saved successfully.</p>}

        {(meta.fieldType === "propertyId" || meta.fieldType === "siteUrl") ? (
          <>
            {/* OAuth placeholder for GA4/GSC */}
            <p className="text-xs text-muted-foreground italic">
              OAuth connection coming soon. Enter your {meta.fieldLabel} manually for now.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={`ds-${type}-field`}>{meta.fieldLabel}</Label>
              <Input
                id={`ds-${type}-field`}
                placeholder={meta.fieldPlaceholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            {/* TODO: Encrypt API keys before storing in production */}
            <Label htmlFor={`ds-${type}-field`}>{meta.fieldLabel}</Label>
            <Input
              id={`ds-${type}-field`}
              type="password"
              placeholder={meta.fieldPlaceholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isLoading}
            />
          </div>
        )}

        {existing?.lastSyncedAt && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(existing.lastSyncedAt).toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={isLoading}>
            <LinkIcon className="h-3.5 w-3.5" />
            {isLoading ? "Saving..." : "Save"}
          </Button>
          {isConnected && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DataSourceFormProps {
  clientId: string;
  existingSources: DataSource[];
}

export function DataSourceForm({ clientId, existingSources }: DataSourceFormProps) {
  const sourceMap = new Map(existingSources.map((s) => [s.type, s]));
  const types: DataSourceType[] = ["GA4", "GSC", "AHREFS", "RANKSCALE", "SEMRUSH"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {types.map((type) => (
        <DataSourceCard
          key={type}
          clientId={clientId}
          type={type}
          existing={sourceMap.get(type)}
        />
      ))}
    </div>
  );
}
