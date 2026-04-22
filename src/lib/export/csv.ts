/**
 * CSV export utilities.
 * `downloadCSV` is browser-only. `*toCSV` string functions are safe server-side too.
 */

export interface KeywordData {
	keyword: string;
	monthlyVolume: number | null;
	difficulty: number | null;
	intent: string | null;
	priority: string | null;
	currentPosition: number | null;
	targetPosition: number | null;
	targetUrl: string | null;
	status: string | null;
	notes: string | null;
}

export interface MetricRow {
	date: string;
	[key: string]: string | number | null;
}

export interface ImplementationChangeCsvData {
	id: string;
	title: string;
	targetRef: string | null;
	changeType: string | null;
	status: string | null;
	approvalStatus: string | null;
	executedAt: string | null;
	rolledBackAt: string | null;
	updatedAt: string | null;
}

function escapeCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	const raw = String(value);
	const str = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function rowsToCSV(headers: string[], rows: unknown[][]): string {
	const lines: string[] = [headers.map(escapeCell).join(",")];
	for (const row of rows) {
		lines.push(row.map(escapeCell).join(","));
	}
	return lines.join("\r\n");
}

/** Converts an array of objects to CSV and triggers a browser download. */
export function downloadCSV(
	data: Record<string, unknown>[],
	filename: string,
): void {
	if (data.length === 0) return;
	const headers = Object.keys(data[0]);
	const rows = data.map((obj) => headers.map((h) => obj[h]));
	const csv = rowsToCSV(headers, rows);
	const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Returns CSV string for keyword research data. */
export function keywordsToCSV(keywords: KeywordData[]): string {
	const headers = [
		"Keyword",
		"Monthly Volume",
		"Difficulty",
		"Intent",
		"Priority",
		"Current Position",
		"Target Position",
		"Target URL",
		"Status",
		"Notes",
	];
	const rows = keywords.map((kw) => [
		kw.keyword,
		kw.monthlyVolume,
		kw.difficulty,
		kw.intent,
		kw.priority,
		kw.currentPosition,
		kw.targetPosition,
		kw.targetUrl,
		kw.status,
		kw.notes,
	]);
	return rowsToCSV(headers, rows);
}

/** Returns CSV string for GA4/GSC metrics data. */
export function metricsToCSV(metrics: MetricRow[]): string {
	if (metrics.length === 0) return "";
	const headers = Object.keys(metrics[0]);
	const rows = metrics.map((m) => headers.map((h) => m[h]));
	return rowsToCSV(headers, rows);
}

/** Returns CSV string for client-safe implementation change data. */
export function implementationChangesToCSV(
	changes: ImplementationChangeCsvData[],
): string {
	const headers = [
		"Proposal ID",
		"Title",
		"Target",
		"Type",
		"Status",
		"Approval",
		"Executed At",
		"Rolled Back At",
		"Last Updated",
	];

	const rows = changes.map((change) => [
		change.id,
		change.title,
		change.targetRef,
		change.changeType,
		change.status,
		change.approvalStatus,
		change.executedAt,
		change.rolledBackAt,
		change.updatedAt,
	]);

	return rowsToCSV(headers, rows);
}
