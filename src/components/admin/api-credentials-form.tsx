"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, Save, TestTube2, Loader2 } from "lucide-react";

type Provider = "GA4" | "GSC" | "MOZ" | "DATAFORSEO" | "RANKSCALE";

interface MaskedCredential {
	provider: Provider;
	credentials: Record<string, string>;
	isActive: boolean;
	lastTestedAt: string | null;
}

interface ProviderConfig {
	label: string;
	description: string;
	fields: {
		key: string;
		label: string;
		type: "text" | "password" | "textarea";
		placeholder: string;
	}[];
}

const PROVIDER_CONFIG: Record<Provider, ProviderConfig> = {
	GA4: {
		label: "Google Analytics 4",
		description: "Service account credentials for GA4 data access.",
		fields: [
			{
				key: "serviceAccountEmail",
				label: "Service Account Email",
				type: "text",
				placeholder: "analytics@project.iam.gserviceaccount.com",
			},
			{
				key: "privateKey",
				label: "Private Key",
				type: "textarea",
				placeholder:
					"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
			},
		],
	},
	GSC: {
		label: "Google Search Console",
		description: "Service account credentials for GSC data access.",
		fields: [
			{
				key: "serviceAccountEmail",
				label: "Service Account Email",
				type: "text",
				placeholder: "search-console@project.iam.gserviceaccount.com",
			},
			{
				key: "privateKey",
				label: "Private Key",
				type: "textarea",
				placeholder:
					"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
			},
		],
	},
	MOZ: {
		label: "Moz",
		description: "Moz API credentials for domain authority and link data.",
		fields: [
			{
				key: "accessId",
				label: "Access ID",
				type: "text",
				placeholder: "mozscape-xxxxxxxx",
			},
			{
				key: "secretKey",
				label: "Secret Key",
				type: "password",
				placeholder: "Enter your Moz secret key",
			},
		],
	},
	DATAFORSEO: {
		label: "DataForSEO",
		description: "DataForSEO credentials for SERP and keyword data.",
		fields: [
			{
				key: "login",
				label: "Login",
				type: "text",
				placeholder: "your@email.com",
			},
			{
				key: "password",
				label: "Password",
				type: "password",
				placeholder: "Enter your DataForSEO password",
			},
		],
	},
	RANKSCALE: {
		label: "RankScale",
		description: "RankScale API key for AI visibility tracking.",
		fields: [
			{
				key: "apiKey",
				label: "API Key",
				type: "password",
				placeholder: "Enter your RankScale API key",
			},
		],
	},
};

const PROVIDERS: Provider[] = ["GA4", "GSC", "MOZ", "DATAFORSEO", "RANKSCALE"];

interface ProviderCardProps {
	provider: Provider;
	existing?: MaskedCredential;
}

function ProviderCard({ provider, existing }: ProviderCardProps) {
	const config = PROVIDER_CONFIG[provider];
	const hasExisting = !!existing;

	// Initialize form values as empty strings (user enters new values to save)
	const initialValues: Record<string, string> = {};
	for (const field of config.fields) {
		initialValues[field.key] = "";
	}

	const [values, setValues] = useState<Record<string, string>>(initialValues);
	const [isSaving, setIsSaving] = useState(false);
	const [isTesting, setIsTesting] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);

	const handleSave = async () => {
		// Validate that all fields have values
		const hasEmpty = config.fields.some((f) => !values[f.key]?.trim());
		if (hasEmpty) {
			toast.error("All fields are required.");
			return;
		}

		setIsSaving(true);
		setTestResult(null);
		try {
			const res = await fetch("/api/settings/api-credentials", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider,
					credentials: values,
				}),
			});

			if (!res.ok) {
				const json = (await res.json()) as { error?: string };
				throw new Error(json.error ?? "Failed to save credentials");
			}

			toast.success(`${config.label} credentials saved.`);
			// Clear form after saving
			setValues(initialValues);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleTest = async () => {
		setIsTesting(true);
		setTestResult(null);
		try {
			const res = await fetch("/api/settings/api-credentials/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ provider }),
			});

			const json = (await res.json()) as {
				success: boolean;
				message: string;
			};

			setTestResult(json);
			if (json.success) {
				toast.success(json.message);
			} else {
				toast.error(json.message);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Test failed";
			setTestResult({ success: false, message: msg });
			toast.error(msg);
		} finally {
			setIsTesting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{hasExisting ? (
							<CheckCircle className="h-4 w-4 text-green-500" />
						) : (
							<Circle className="h-4 w-4 text-muted-foreground" />
						)}
						<CardTitle className="text-base">{config.label}</CardTitle>
					</div>
					<span
						className={`text-xs font-medium px-2 py-0.5 rounded-full ${
							hasExisting
								? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{hasExisting ? "Configured" : "Not configured"}
					</span>
				</div>
				<p className="text-sm text-muted-foreground">{config.description}</p>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Existing masked credentials display */}
				{hasExisting && (
					<div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm space-y-1">
						<p className="text-xs font-medium text-muted-foreground">
							Current credentials (masked):
						</p>
						{Object.entries(existing.credentials).map(([key, value]) => (
							<div
								key={key}
								className="grid grid-cols-[140px_1fr] gap-2 text-xs"
							>
								<span className="text-muted-foreground font-mono">{key}</span>
								<span className="font-mono">{value}</span>
							</div>
						))}
					</div>
				)}

				{/* Input fields */}
				{config.fields.map((field) => (
					<div key={field.key} className="space-y-1.5">
						<Label htmlFor={`cred-${provider}-${field.key}`}>
							{field.label}
							{hasExisting && (
								<span className="text-xs text-muted-foreground ml-1">
									(enter new value to update)
								</span>
							)}
						</Label>
						{field.type === "textarea" ? (
							<textarea
								id={`cred-${provider}-${field.key}`}
								className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
								placeholder={field.placeholder}
								value={values[field.key]}
								onChange={(e) =>
									setValues((prev) => ({
										...prev,
										[field.key]: e.target.value,
									}))
								}
								disabled={isSaving}
							/>
						) : (
							<Input
								id={`cred-${provider}-${field.key}`}
								type={field.type}
								placeholder={field.placeholder}
								value={values[field.key]}
								onChange={(e) =>
									setValues((prev) => ({
										...prev,
										[field.key]: e.target.value,
									}))
								}
								disabled={isSaving}
							/>
						)}
					</div>
				))}

				{/* Test result */}
				{testResult && (
					<div
						className={`rounded-lg border px-3 py-2 text-sm ${
							testResult.success
								? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
								: "border-destructive/30 bg-destructive/5 text-destructive"
						}`}
					>
						{testResult.message}
					</div>
				)}

				{/* Last tested timestamp */}
				{existing?.lastTestedAt && (
					<p className="text-xs text-muted-foreground">
						Last tested: {new Date(existing.lastTestedAt).toLocaleString()}
					</p>
				)}

				{/* Action buttons */}
				<div className="flex items-center gap-2 pt-1">
					<Button size="sm" onClick={handleSave} disabled={isSaving}>
						{isSaving ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Save className="h-3.5 w-3.5" />
						)}
						{isSaving ? "Saving..." : "Save"}
					</Button>
					{hasExisting && (
						<Button
							size="sm"
							variant="outline"
							onClick={handleTest}
							disabled={isTesting}
						>
							{isTesting ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<TestTube2 className="h-3.5 w-3.5" />
							)}
							{isTesting ? "Testing..." : "Test Connection"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

interface ApiCredentialsFormProps {
	initialCredentials: MaskedCredential[];
}

export function ApiCredentialsForm({
	initialCredentials,
}: ApiCredentialsFormProps) {
	const credMap = new Map(initialCredentials.map((c) => [c.provider, c]));

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			{PROVIDERS.map((provider) => (
				<ProviderCard
					key={provider}
					provider={provider}
					existing={credMap.get(provider)}
				/>
			))}
		</div>
	);
}
