import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EeatRecommendation } from "@/lib/eeat/scoring";

interface EeatFactorView {
	label: string;
	score: number;
}

interface EeatScoreCardProps {
	overallScore: number | null;
	scoreVersion: string | null;
	factors: EeatFactorView[];
	recommendations: EeatRecommendation[];
	updatedAt: Date | null;
	noData?: boolean;
}

function formatScore(score: number): string {
	return Math.round(score).toString();
}

export function EeatScoreCard({
	overallScore,
	scoreVersion,
	factors,
	recommendations,
	updatedAt,
	noData = false,
}: EeatScoreCardProps) {
	if (noData || overallScore === null) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium flex items-center gap-2">
						<ShieldCheck className="h-4 w-4" />
						EEAT Score
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						No EEAT score yet — submit a questionnaire response to generate one.
					</p>
				</CardContent>
			</Card>
		);
	}

	const topFactors = [...factors].sort((a, b) => b.score - a.score).slice(0, 3);
	const topRecommendations = recommendations.slice(0, 2);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<ShieldCheck className="h-4 w-4" />
					EEAT Score
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-end justify-between">
					<div>
						<p className="text-xs text-muted-foreground">Overall</p>
						<p className="text-3xl font-bold tabular-nums">
							{formatScore(overallScore)}
							<span className="text-base text-muted-foreground">/100</span>
						</p>
					</div>
					<div className="text-right text-xs text-muted-foreground">
						{scoreVersion ? <p>{scoreVersion}</p> : null}
						{updatedAt ? <p>{updatedAt.toLocaleDateString()}</p> : null}
					</div>
				</div>

				{topFactors.length > 0 ? (
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
						{topFactors.map((factor) => (
							<div
								key={factor.label}
								className="rounded-lg border bg-muted/30 px-3 py-2"
							>
								<p className="text-xs text-muted-foreground">{factor.label}</p>
								<p className="text-base font-semibold tabular-nums">
									{formatScore(factor.score)}
								</p>
							</div>
						))}
					</div>
				) : null}

				{topRecommendations.length > 0 ? (
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">Recommendations</p>
						<div className="space-y-2">
							{topRecommendations.map((recommendation) => (
								<div
									key={`${recommendation.title}-${recommendation.rationale}`}
									className="rounded-lg border bg-muted/20 px-3 py-2"
								>
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-sm font-medium text-foreground">
											{recommendation.title}
										</p>
										<span className="text-[10px] rounded bg-muted px-1.5 py-0.5">
											Impact {recommendation.impact}
										</span>
										<span className="text-[10px] rounded bg-muted px-1.5 py-0.5">
											Effort {recommendation.effort}
										</span>
									</div>
									<p className="text-xs text-muted-foreground mt-1">
										{recommendation.rationale}
									</p>
									{recommendation.moduleHint ||
									recommendation.linkedResourceHint ? (
										<p className="text-[11px] text-muted-foreground/90 mt-1">
											{recommendation.moduleHint
												? `Module: ${recommendation.moduleHint}`
												: null}
											{recommendation.moduleHint &&
											recommendation.linkedResourceHint
												? " · "
												: null}
											{recommendation.linkedResourceHint
												? `Hint: ${recommendation.linkedResourceHint}`
												: null}
										</p>
									) : null}
								</div>
							))}
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}
