interface OnboardingStep {
	key: string;
	label: string;
}

interface OnboardingStepperProps {
	steps: OnboardingStep[];
	currentStepIndex: number;
	onStepSelect: (index: number) => void;
	disabled?: boolean;
}

export function OnboardingStepper({
	steps,
	currentStepIndex,
	onStepSelect,
	disabled = false,
}: OnboardingStepperProps) {
	return (
		<ol className="grid gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Onboarding steps">
			{steps.map((step, index) => {
				const isActive = index === currentStepIndex;
				const isComplete = index < currentStepIndex;
				return (
					<li key={step.key}>
						<button
							type="button"
							onClick={() => onStepSelect(index)}
							disabled={disabled}
							className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
								isActive
									? "border-primary bg-primary/5 text-foreground"
									: isComplete
										? "border-border bg-muted/40 text-foreground"
										: "border-border text-muted-foreground hover:text-foreground"
							}`}
						>
							<span
								className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
									isActive
										? "bg-primary text-primary-foreground"
										: isComplete
											? "bg-green-600 text-white"
											: "bg-muted text-muted-foreground"
								}`}
							>
								{index + 1}
							</span>
							<span className="line-clamp-2">{step.label}</span>
						</button>
					</li>
				);
			})}
		</ol>
	);
}
