import { Target, TrendingUp } from "lucide-react";
import { getOnboardingProfile } from "@/lib/onboarding";

interface NorthStarRibbonSummary {
	statement: string | null;
	metricName: string | null;
	currentValue: number | null;
	targetValue: number | null;
	targetDate: string | null;
	status: "DRAFT" | "COMPLETED" | null;
}

interface NorthStarRibbonProps {
	clientId: string;
	onboardingHref?: string;
}

interface NorthStarRibbonViewProps {
	summary: NorthStarRibbonSummary;
	onboardingHref?: string;
}

function formatValue(value: number | null): string {
	if (value === null || Number.isNaN(value)) {
		return "—";
	}

	return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatTargetDate(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return value;
	}

	return parsed.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function calculateProgress(
	currentValue: number | null,
	targetValue: number | null,
): number | null {
	if (
		currentValue === null ||
		targetValue === null ||
		targetValue <= 0 ||
		Number.isNaN(currentValue) ||
		Number.isNaN(targetValue)
	) {
		return null;
	}

	return Math.max(0, Math.min(100, (currentValue / targetValue) * 100));
}

export function NorthStarRibbonView({
	summary,
	onboardingHref,
}: NorthStarRibbonViewProps) {
	if (!summary.statement) {
		return (
			<div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
				<div className="flex items-start gap-2">
					<Target className="mt-0.5 h-4 w-4 text-muted-foreground" />
					<div className="space-y-1">
						<p className="text-sm font-medium">North Star not set</p>
						<p className="text-xs text-muted-foreground">
							This client has not completed onboarding yet.
							{onboardingHref ? (
								<>
									{" "}
									<a href={onboardingHref} className="underline hover:text-foreground">
										Set North Star
									</a>
									.
								</>
							) : null}
						</p>
					</div>
				</div>
			</div>
		);
	}

	const progress = calculateProgress(summary.currentValue, summary.targetValue);
	const targetDate = formatTargetDate(summary.targetDate);

	return (
		<div className="rounded-lg border border-border bg-card px-4 py-3">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="space-y-1">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						North Star
					</p>
					<p className="text-sm font-semibold text-foreground">{summary.statement}</p>
					<p className="text-xs text-muted-foreground">
						{summary.metricName ?? "Metric"}: {formatValue(summary.currentValue)} / {formatValue(summary.targetValue)}
						{targetDate ? ` by ${targetDate}` : ""}
					</p>
				</div>
				<div className="min-w-44 space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="inline-flex items-center gap-1 text-muted-foreground">
							<TrendingUp className="h-3.5 w-3.5" />
							Progress
						</span>
						<span className="font-medium text-foreground">
							{progress === null ? "N/A" : `${Math.round(progress)}%`}
						</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-all"
							style={{ width: `${progress ?? 0}%` }}
						/>
					</div>
					<p className="text-[11px] text-muted-foreground">
						{summary.status === "COMPLETED"
							? "Onboarding complete"
							: "Onboarding draft"}
					</p>
				</div>
			</div>
		</div>
	);
}

export async function NorthStarRibbon({ clientId, onboardingHref }: NorthStarRibbonProps) {
	const profile = await getOnboardingProfile(clientId);

	return (
		<NorthStarRibbonView
			summary={{
				statement: profile.northStarGoal?.statement ?? null,
				metricName: profile.northStarGoal?.metricName ?? null,
				currentValue: profile.northStarGoal?.currentValue ?? null,
				targetValue: profile.northStarGoal?.targetValue ?? null,
				targetDate: profile.northStarGoal?.targetDate ?? null,
				status: profile.profile?.status ?? null,
			}}
			onboardingHref={onboardingHref}
		/>
	);
}
