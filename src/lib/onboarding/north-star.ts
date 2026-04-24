interface NorthStarSuggestionInput {
	businessName?: string | null;
	industry?: string | null;
	primaryOffer?: string | null;
	primaryConversion?: string | null;
	monthlyLeads?: number | null;
	competitorCount?: number;
}

export interface NorthStarSuggestion {
	statement: string;
	metricName: string;
	targetValue: number | null;
	timeHorizonMonths: number;
	targetDate: string | null;
	confidenceNotes: string;
}

function toTitleCase(value: string): string {
	return value
		.split(" ")
		.filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

function inferMetricName(primaryConversion: string | null | undefined): string {
	const conversion = (primaryConversion ?? "").toLowerCase();
	if (conversion.includes("demo")) return "Qualified demos";
	if (conversion.includes("trial")) return "Free trials";
	if (conversion.includes("lead") || conversion.includes("form")) return "Qualified leads";
	if (conversion.includes("call")) return "Booked calls";
	if (conversion.includes("sale") || conversion.includes("purchase") || conversion.includes("checkout")) {
		return "Monthly purchases";
	}
	return "Qualified leads";
}

function inferTargetValue(
	metricName: string,
	monthlyLeads: number | null | undefined,
): number | null {
	if (typeof monthlyLeads === "number" && Number.isFinite(monthlyLeads) && monthlyLeads > 0) {
		return Math.ceil(monthlyLeads * 1.5);
	}

	if (metricName.toLowerCase().includes("purchase")) return 80;
	if (metricName.toLowerCase().includes("demo")) return 60;
	if (metricName.toLowerCase().includes("trial")) return 120;
	return 100;
}

function inferTimeHorizonMonths(competitorCount: number): number {
	if (competitorCount >= 5) return 12;
	if (competitorCount >= 2) return 9;
	return 6;
}

function buildTargetDate(monthsFromNow: number): string {
	const target = new Date();
	target.setMonth(target.getMonth() + monthsFromNow);
	return target.toISOString().slice(0, 10);
}

export function generateNorthStarSuggestion(
	input: NorthStarSuggestionInput,
): NorthStarSuggestion {
	const businessName = (input.businessName?.trim() || "This client").replace(/\s+/g, " ");
	const industry = input.industry?.trim() || null;
	const primaryOffer = input.primaryOffer?.trim() || null;
	const metricName = inferMetricName(input.primaryConversion);
	const targetValue = inferTargetValue(metricName, input.monthlyLeads);
	const competitorCount = Number.isFinite(input.competitorCount)
		? Math.max(0, Math.trunc(input.competitorCount ?? 0))
		: 0;
	const timeHorizonMonths = inferTimeHorizonMonths(competitorCount);

	const contextParts = [industry, primaryOffer].filter(Boolean);
	const contextLabel = contextParts.length > 0 ? ` in ${contextParts.join(" / ")}` : "";

	const statementTarget = targetValue ? `${targetValue} ${metricName.toLowerCase()}` : metricName;
	const statement = `Increase ${businessName}${contextLabel} to ${statementTarget} within ${timeHorizonMonths} months.`;

	const confidenceNotes = [
		"Auto-generated draft from onboarding inputs.",
		`Assumes a ${timeHorizonMonths}-month horizon based on current competitive context (${competitorCount} competitors captured).`,
		"Adjust target value and horizon with the client before finalizing.",
	].join(" ");

	return {
		statement,
		metricName: toTitleCase(metricName),
		targetValue,
		timeHorizonMonths,
		targetDate: buildTargetDate(timeHorizonMonths),
		confidenceNotes,
	};
}
