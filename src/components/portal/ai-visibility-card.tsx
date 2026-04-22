import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AiVisibilityCardProps {
	overallScore: number | null;
	rankscaleScore: number | null;
	secondaryScore: number | null; // Can be integer from DB
	totalPromptsTested: number;
	promptsVisible: number;
	noData?: boolean;
}

function CircularProgress({
	score,
	size = 96,
}: {
	score: number;
	size?: number;
}) {
	const radius = (size - 12) / 2;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference - (score / 100) * circumference;

	// Color based on score
	const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";

	return (
		<div className="relative inline-flex items-center justify-center">
			<svg width={size} height={size} className="-rotate-90" aria-hidden="true">
				{/* Background track */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="8"
					className="text-muted/40"
				/>
				{/* Progress */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth="8"
					strokeDasharray={circumference}
					strokeDashoffset={dashOffset}
					strokeLinecap="round"
				/>
			</svg>
			<span
				className="absolute text-xl font-bold tabular-nums"
				style={{ color }}
			>
				{Math.round(score)}
			</span>
		</div>
	);
}

function ScorePill({ label, score }: { label: string; score: number | null }) {
	return (
		<div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 px-4 py-2 flex-1">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="text-lg font-bold">
				{score !== null ? Math.round(score) : "—"}
			</span>
		</div>
	);
}

export function AiVisibilityCard({
	overallScore,
	rankscaleScore,
	secondaryScore,
	totalPromptsTested,
	promptsVisible,
	noData = false,
}: AiVisibilityCardProps) {
	if (noData || overallScore === null) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium flex items-center gap-2">
						<Sparkles className="h-4 w-4" />
						AI Visibility Score
					</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-center h-48">
					<p className="text-sm text-muted-foreground">
						No data yet — connect your data sources
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium flex items-center gap-2">
					<Sparkles className="h-4 w-4" />
					AI Visibility Score
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Overall score ring */}
				<div className="flex flex-col items-center gap-1">
					<CircularProgress score={overallScore} />
					<p className="text-xs text-muted-foreground">Overall Score</p>
				</div>

				{/* Breakdown */}
				<div className="flex gap-2">
					<ScorePill label="Rankscale" score={rankscaleScore} />
					<ScorePill label="Secondary" score={secondaryScore} />
				</div>

				{/* Prompts */}
				{totalPromptsTested > 0 && (
					<p className="text-xs text-muted-foreground text-center">
						Visible in{" "}
						<span className="font-semibold text-foreground">
							{promptsVisible}
						</span>{" "}
						of{" "}
						<span className="font-semibold text-foreground">
							{totalPromptsTested}
						</span>{" "}
						prompts tested
					</p>
				)}
			</CardContent>
		</Card>
	);
}
