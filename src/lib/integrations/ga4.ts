/**
 * GA4 Integration — Google Analytics Data API v1
 * Docs: https://developers.google.com/analytics/devguides/reporting/data/v1
 *
 * Auth: Agency service account via google-auth-library
 * Property: stored in dataSources.propertyIdentifier
 */

import { GoogleAuth } from "google-auth-library";
import { db } from "@/lib/db";
import { apiCredentials, dataSources, ga4Metrics } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { eq, and } from "drizzle-orm";
import type { SyncResult } from "./types";

export type { SyncResult as GA4SyncResult };

// ─── GA4 API Types ────────────────────────────────────────────────────────────

interface GA4DimensionHeader {
	name: string;
}

interface GA4MetricHeader {
	name: string;
	type: string;
}

interface GA4DimensionValue {
	value: string;
}

interface GA4MetricValue {
	value: string;
}

interface GA4Row {
	dimensionValues: GA4DimensionValue[];
	metricValues: GA4MetricValue[];
}

interface GA4ReportResponse {
	dimensionHeaders: GA4DimensionHeader[];
	metricHeaders: GA4MetricHeader[];
	rows?: GA4Row[];
	rowCount?: number;
	error?: {
		code: number;
		message: string;
		status: string;
	};
}

// ─── Sync Function ────────────────────────────────────────────────────────────

export async function syncGA4Data(
	clientId: string,
	daysBack = 90,
): Promise<SyncResult> {
	const source = "GA4";

	// 1. Read agency credential for GA4
	const credential = await db
		.select()
		.from(apiCredentials)
		.where(
			and(
				eq(apiCredentials.provider, "GA4"),
				eq(apiCredentials.isActive, true),
			),
		)
		.get();

	if (!credential) {
		return {
			success: false,
			rowsInserted: 0,
			error: "No active GA4 agency credential configured",
			source,
		};
	}

	// 2. Fetch per-client dataSource record
	const dataSource = await db
		.select()
		.from(dataSources)
		.where(and(eq(dataSources.clientId, clientId), eq(dataSources.type, "GA4")))
		.get();

	if (!dataSource) {
		return {
			success: false,
			rowsInserted: 0,
			error: "GA4 data source not configured",
			source,
		};
	}

	if (!dataSource.isConnected) {
		return {
			success: false,
			rowsInserted: 0,
			error: "GA4 not connected",
			source,
		};
	}

	const propertyId = dataSource.propertyIdentifier;
	if (!propertyId) {
		return {
			success: false,
			rowsInserted: 0,
			error: "GA4 property ID not set",
			source,
		};
	}

	try {
		// 3. Decrypt service account credentials and obtain access token
		const creds = JSON.parse(decrypt(credential.credentialsEnc)) as {
			serviceAccountEmail: string;
			privateKey: string;
		};

		const googleAuth = new GoogleAuth({
			credentials: {
				client_email: creds.serviceAccountEmail,
				private_key: creds.privateKey,
			},
			scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
		});

		const client = await googleAuth.getClient();
		const tokenResponse = await client.getAccessToken();
		const accessToken =
			typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;

		if (!accessToken) {
			throw new Error("Failed to obtain access token from service account");
		}

		// 4. Call GA4 Data API
		const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

		const requestBody = {
			dateRanges: [
				{
					startDate: `${daysBack}daysAgo`,
					endDate: "today",
				},
			],
			dimensions: [{ name: "date" }],
			metrics: [
				{ name: "sessions" },
				{ name: "totalUsers" },
				{ name: "newUsers" },
				{ name: "screenPageViews" },
				{ name: "bounceRate" },
				{ name: "averageSessionDuration" },
				{ name: "organicGoogleSearchSessions" },
			],
		};

		const response = await fetch(apiUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`GA4 API error ${response.status}: ${errorText}`);
		}

		const data = (await response.json()) as GA4ReportResponse;

		if (data.error) {
			throw new Error(`GA4 API error: ${data.error.message}`);
		}

		const rows = data.rows ?? [];

		// 5. Upsert into ga4Metrics table
		let rowsInserted = 0;

		for (const row of rows) {
			// GA4 date format: YYYYMMDD → convert to YYYY-MM-DD
			const rawDate = row.dimensionValues[0]?.value ?? "";
			const date =
				rawDate.length === 8
					? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
					: rawDate;

			const metrics = row.metricValues;
			const sessions = parseInt(metrics[0]?.value ?? "0", 10) || 0;
			const users = parseInt(metrics[1]?.value ?? "0", 10) || 0;
			const newUsers = parseInt(metrics[2]?.value ?? "0", 10) || 0;
			const pageviews = parseInt(metrics[3]?.value ?? "0", 10) || 0;
			const bounceRate = parseFloat(metrics[4]?.value ?? "0") || null;
			const avgSessionDuration = parseFloat(metrics[5]?.value ?? "0") || null;
			const organicSessions = parseInt(metrics[6]?.value ?? "0", 10) || 0;

			// Upsert: SQLite ON CONFLICT via Drizzle
			await db
				.insert(ga4Metrics)
				.values({
					clientId,
					date,
					sessions,
					users,
					newUsers,
					pageviews,
					bounceRate,
					avgSessionDuration,
					organicSessions,
				})
				.onConflictDoUpdate({
					target: [ga4Metrics.clientId, ga4Metrics.date],
					set: {
						sessions,
						users,
						newUsers,
						pageviews,
						bounceRate,
						avgSessionDuration,
						organicSessions,
					},
				});

			rowsInserted++;
		}

		// 6. Update lastSyncedAt
		await db
			.update(dataSources)
			.set({ lastSyncedAt: new Date(), lastSyncError: null })
			.where(eq(dataSources.id, dataSource.id));

		return { success: true, rowsInserted, source };
	} catch (err) {
		const errorMsg =
			err instanceof Error ? err.message : "Unknown GA4 sync error";

		// Update lastSyncError
		await db
			.update(dataSources)
			.set({ lastSyncError: errorMsg })
			.where(eq(dataSources.id, dataSource.id));

		return { success: false, rowsInserted: 0, error: errorMsg, source };
	}
}
