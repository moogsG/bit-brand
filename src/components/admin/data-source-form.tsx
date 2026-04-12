"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DataSource } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, Link as LinkIcon, Unlink } from "lucide-react";

type DataSourceType = "GA4" | "GSC" | "MOZ" | "RANKSCALE" | "DATAFORSEO";

const DATA_SOURCE_META: Record<
	DataSourceType,
	{
		label: string;
		description: string;
		fieldType: "propertyId" | "siteUrl" | "apiKey" | "agencyToggle";
		fieldLabel: string;
		fieldPlaceholder: string;
	}
> = {
	GA4: {
		label: "Google Analytics 4",
		description:
			"Connect your GA4 property for traffic data. Service account configured in API Credentials settings.",
		fieldType: "propertyId",
		fieldLabel: "GA4 Property ID",
		fieldPlaceholder: "123456789",
	},
	GSC: {
		label: "Google Search Console",
		description:
			"Connect GSC for organic search performance data. Service account configured in API Credentials settings.",
		fieldType: "siteUrl",
		fieldLabel: "Site URL",
		fieldPlaceholder: "https://example.com/",
	},
	MOZ: {
		label: "Moz",
		description:
			"Domain authority, page authority, spam score, and backlink data. Credentials managed in API Credentials settings.",
		fieldType: "agencyToggle",
		fieldLabel: "",
		fieldPlaceholder: "",
	},
	RANKSCALE: {
		label: "RankScale",
		description:
			"AI visibility tracking across ChatGPT, Perplexity, and Gemini. Credentials managed in API Credentials settings.",
		fieldType: "agencyToggle",
		fieldLabel: "",
		fieldPlaceholder: "",
	},
	DATAFORSEO: {
		label: "DataForSEO",
		description:
			"Keyword volume and difficulty enrichment. Credentials managed in API Credentials settings.",
		fieldType: "agencyToggle",
		fieldLabel: "",
		fieldPlaceholder: "",
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
		if (meta.fieldType === "propertyId" || meta.fieldType === "siteUrl") {
			return existing.propertyIdentifier ?? "";
		}
		return "";
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
				isConnected: true,
			};

			if (meta.fieldType === "propertyId" || meta.fieldType === "siteUrl") {
				payload.propertyIdentifier = value.trim() || null;
				payload.isConnected = value.trim().length > 0;
			}
			// agencyToggle: just set isConnected = true, no per-client credentials

			const res = await fetch(`/api/clients/${clientId}/data-sources`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const json = (await res.json()) as { error?: string };
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
			if (meta.fieldType === "propertyId" || meta.fieldType === "siteUrl") {
				payload.propertyIdentifier = null;
			}

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
				{success && (
					<p className="text-xs text-green-600">Saved successfully.</p>
				)}

				{meta.fieldType === "propertyId" && (
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
				)}

				{meta.fieldType === "siteUrl" && (
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
				)}

				{meta.fieldType === "agencyToggle" && !isConnected && (
					<p className="text-xs text-muted-foreground italic">
						Enable this source for the client. API credentials are managed
						centrally in the API Credentials settings page.
					</p>
				)}

				{existing?.lastSyncedAt && (
					<p className="text-xs text-muted-foreground">
						Last synced: {new Date(existing.lastSyncedAt).toLocaleString()}
					</p>
				)}

				<div className="flex items-center gap-2">
					<Button size="sm" onClick={handleSave} disabled={isLoading}>
						<LinkIcon className="h-3.5 w-3.5" />
						{isLoading
							? "Saving..."
							: meta.fieldType === "agencyToggle" && !isConnected
								? "Enable"
								: "Save"}
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

export function DataSourceForm({
	clientId,
	existingSources,
}: DataSourceFormProps) {
	const sourceMap = new Map(existingSources.map((s) => [s.type, s]));
	const types: DataSourceType[] = [
		"GA4",
		"GSC",
		"MOZ",
		"RANKSCALE",
		"DATAFORSEO",
	];

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
