"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingProfileResponse } from "@/lib/onboarding";
import {
	buildDraftPayload,
	buildFinalPayload,
	profileToWizardValues,
} from "./payload";
import { OnboardingStepper } from "./onboarding-stepper";
import {
	onboardingWizardDefaultValues,
	onboardingWizardSubmitSchema,
	type OnboardingWizardValues,
} from "./schemas";

interface OnboardingWizardProps {
	clientId: string;
	clientName: string;
	canEdit: boolean;
}

interface ProfileMeta {
	version: number;
	status: "DRAFT" | "COMPLETED";
	updatedAt: string;
}

const steps: { key: keyof OnboardingWizardValues; label: string }[] = [
	{ key: "businessFundamentals", label: "Business Fundamentals" },
	{ key: "northStarGoal", label: "North Star Goal" },
	{ key: "conversionArchitecture", label: "Conversion Architecture" },
	{ key: "strategicLevers", label: "Strategic Levers" },
	{ key: "competitors", label: "Competitors" },
	{ key: "currentStateBaseline", label: "Current-State Baseline" },
];

function parseNumberOrNull(value: unknown): number | null {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}

	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerOrNull(value: unknown): number | null {
	const parsed = parseNumberOrNull(value);
	return parsed === null ? null : Math.trunc(parsed);
}

export function OnboardingWizard({
	clientId,
	clientName,
	canEdit,
}: OnboardingWizardProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [isLoadingProfile, setIsLoadingProfile] = useState(true);
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [profileMeta, setProfileMeta] = useState<ProfileMeta | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	const {
		control,
		formState: { errors },
		getValues,
		register,
		reset,
		setValue,
		trigger,
		watch,
	} = useForm<OnboardingWizardValues>({
		resolver: zodResolver(onboardingWizardSubmitSchema) as never,
		defaultValues: onboardingWizardDefaultValues,
		mode: "onBlur",
	});

	const strategicLevers = useFieldArray({
		control,
		name: "strategicLevers",
	});

	const competitors = useFieldArray({
		control,
		name: "competitors",
	});

	const secondaryConversions = watch(
		"conversionArchitecture.secondaryConversions",
		onboardingWizardDefaultValues.conversionArchitecture.secondaryConversions,
	);

	const leadCapturePoints = watch(
		"conversionArchitecture.leadCapturePoints",
		onboardingWizardDefaultValues.conversionArchitecture.leadCapturePoints,
	);

	const secondaryConversionKeys = useMemo(
		() =>
			secondaryConversions.map(
				(value, index) => `secondary-${index}-${value || "empty"}`,
			),
		[secondaryConversions],
	);

	const leadCapturePointKeys = useMemo(
		() =>
			leadCapturePoints.map(
				(value, index) => `lead-capture-${index}-${value || "empty"}`,
			),
		[leadCapturePoints],
	);

	const activeStep = steps[currentStep];

	const loadProfile = useCallback(async () => {
		setIsLoadingProfile(true);
		setLoadError(null);

		try {
			const response = await fetch(`/api/onboarding/${clientId}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(payload.error ?? "Failed to load onboarding profile");
			}

			const payload = (await response.json()) as OnboardingProfileResponse;
			reset(profileToWizardValues(payload));

			if (payload.profile) {
				setProfileMeta({
					version: payload.profile.version,
					status: payload.profile.status,
					updatedAt: payload.profile.updatedAt.toString(),
				});
			} else {
				setProfileMeta(null);
			}
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to load onboarding profile",
			);
		} finally {
			setIsLoadingProfile(false);
		}
	}, [clientId, reset]);

	useEffect(() => {
		void loadProfile();
	}, [loadProfile]);

	const stepErrorCount = useMemo(
		() =>
			steps.map((step) => {
				const entry = errors[step.key];
				return entry ? 1 : 0;
			}),
		[errors],
	);

	async function persist(
		payload: unknown,
		options: { successMessage: string; resetForm: boolean },
	) {
		const response = await fetch(`/api/onboarding/${clientId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const body = (await response.json().catch(() => ({}))) as {
				error?: string;
			};
			throw new Error(body.error ?? "Failed to save onboarding profile");
		}

		const result = (await response.json()) as OnboardingProfileResponse;
		if (result.profile) {
			setProfileMeta({
				version: result.profile.version,
				status: result.profile.status,
				updatedAt: result.profile.updatedAt.toString(),
			});
		}

		if (options.resetForm) {
			reset(profileToWizardValues(result));
		}

		toast.success(options.successMessage);
	}

	async function handleSaveDraft() {
		if (!canEdit) {
			return;
		}

		setIsSavingDraft(true);
		try {
			const payload = buildDraftPayload(getValues(), profileMeta?.version);
			await persist(payload, {
				successMessage: "Draft saved",
				resetForm: false,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to save draft");
		} finally {
			setIsSavingDraft(false);
		}
	}

	async function goToNextStep() {
		const valid = await trigger(activeStep.key, { shouldFocus: true });
		if (!valid) {
			return;
		}

		setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
	}

	async function handleFinalSubmit() {
		if (!canEdit) {
			return;
		}

		for (let index = 0; index < steps.length; index += 1) {
			const valid = await trigger(steps[index].key, { shouldFocus: true });
			if (!valid) {
				setCurrentStep(index);
				toast.error("Resolve validation issues before submitting");
				return;
			}
		}

		setIsSubmitting(true);
		try {
			const payload = buildFinalPayload(getValues(), profileMeta?.version);
			await persist(payload, {
				successMessage: "Onboarding submitted",
				resetForm: true,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to submit");
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isLoadingProfile) {
		return (
			<Card>
				<CardContent className="py-10">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading onboarding profile...
					</div>
				</CardContent>
			</Card>
		);
	}

	if (loadError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Unable to load onboarding</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-sm text-destructive">{loadError}</p>
					<Button type="button" variant="outline" onClick={() => void loadProfile()}>
						Retry
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<CardTitle>{clientName} Onboarding</CardTitle>
							<p className="text-sm text-muted-foreground">
								Complete all sections, save as draft, and submit when ready.
							</p>
						</div>
						{profileMeta ? (
							<p className="text-xs text-muted-foreground">
								Version {profileMeta.version} · {profileMeta.status}
							</p>
						) : (
							<p className="text-xs text-muted-foreground">No saved draft yet</p>
						)}
					</div>

					{!canEdit && (
						<p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
							You have view-only access. Contact an agency owner or account manager to
							make edits.
						</p>
					)}

					<OnboardingStepper
						steps={steps}
						currentStepIndex={currentStep}
						onStepSelect={setCurrentStep}
						disabled={isSavingDraft || isSubmitting}
					/>
				</CardHeader>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{activeStep.label}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{activeStep.key === "businessFundamentals" && (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1.5 md:col-span-2">
								<Label htmlFor="businessName">Business name</Label>
								<Input
									id="businessName"
									disabled={!canEdit}
									{...register("businessFundamentals.businessName")}
								/>
								{errors.businessFundamentals?.businessName && (
									<p className="text-xs text-destructive">
										{errors.businessFundamentals.businessName.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5 md:col-span-2">
								<Label htmlFor="domain">Domain</Label>
								<Input
									id="domain"
									disabled={!canEdit}
									{...register("businessFundamentals.domain")}
								/>
								{errors.businessFundamentals?.domain && (
									<p className="text-xs text-destructive">
										{errors.businessFundamentals.domain.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="industry">Industry</Label>
								<Input id="industry" disabled={!canEdit} {...register("businessFundamentals.industry")} />
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="targetGeo">Target geography</Label>
								<Input
									id="targetGeo"
									disabled={!canEdit}
									{...register("businessFundamentals.targetGeo")}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="primaryOffer">Primary offer</Label>
								<Input
									id="primaryOffer"
									disabled={!canEdit}
									{...register("businessFundamentals.primaryOffer")}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="idealCustomer">Ideal customer</Label>
								<Input
									id="idealCustomer"
									disabled={!canEdit}
									{...register("businessFundamentals.idealCustomer")}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="pricingModel">Pricing model</Label>
								<Input
									id="pricingModel"
									disabled={!canEdit}
									{...register("businessFundamentals.pricingModel")}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="salesCycleDays">Sales cycle (days)</Label>
								<Input
									id="salesCycleDays"
									type="number"
									disabled={!canEdit}
									{...register("businessFundamentals.salesCycleDays", {
										setValueAs: parseIntegerOrNull,
									})}
								/>
								{errors.businessFundamentals?.salesCycleDays && (
									<p className="text-xs text-destructive">
										{errors.businessFundamentals.salesCycleDays.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5 md:col-span-2">
								<Label htmlFor="businessNotes">Notes</Label>
								<textarea
									id="businessNotes"
									rows={4}
									disabled={!canEdit}
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									{...register("businessFundamentals.notes")}
								/>
							</div>
						</div>
					)}

					{activeStep.key === "northStarGoal" && (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1.5 md:col-span-2">
								<Label htmlFor="statement">North Star statement</Label>
								<Input id="statement" disabled={!canEdit} {...register("northStarGoal.statement")} />
								{errors.northStarGoal?.statement && (
									<p className="text-xs text-destructive">
										{errors.northStarGoal.statement.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="metricName">Metric name</Label>
								<Input id="metricName" disabled={!canEdit} {...register("northStarGoal.metricName")} />
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="targetDate">Target date</Label>
								<Input id="targetDate" type="date" disabled={!canEdit} {...register("northStarGoal.targetDate")} />
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="currentValue">Current value</Label>
								<Input
									id="currentValue"
									type="number"
									disabled={!canEdit}
									{...register("northStarGoal.currentValue", {
										setValueAs: parseNumberOrNull,
									})}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="targetValue">Target value</Label>
								<Input
									id="targetValue"
									type="number"
									disabled={!canEdit}
									{...register("northStarGoal.targetValue", {
										setValueAs: parseNumberOrNull,
									})}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="timeHorizonMonths">Time horizon (months)</Label>
								<Input
									id="timeHorizonMonths"
									type="number"
									disabled={!canEdit}
									{...register("northStarGoal.timeHorizonMonths", {
										setValueAs: parseIntegerOrNull,
									})}
								/>
								{errors.northStarGoal?.timeHorizonMonths && (
									<p className="text-xs text-destructive">
										{errors.northStarGoal.timeHorizonMonths.message}
									</p>
								)}
							</div>

							<div className="space-y-1.5 md:col-span-2">
								<Label htmlFor="confidenceNotes">Confidence notes</Label>
								<textarea
									id="confidenceNotes"
									rows={4}
									disabled={!canEdit}
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									{...register("northStarGoal.confidenceNotes")}
								/>
							</div>
						</div>
					)}

					{activeStep.key === "conversionArchitecture" && (
						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="primaryConversion">Primary conversion</Label>
								<Input
									id="primaryConversion"
									disabled={!canEdit}
									{...register("conversionArchitecture.primaryConversion")}
								/>
								{errors.conversionArchitecture?.primaryConversion && (
									<p className="text-xs text-destructive">
										{errors.conversionArchitecture.primaryConversion.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Secondary conversions</Label>
									{canEdit && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												setValue(
													"conversionArchitecture.secondaryConversions",
													[...secondaryConversions, ""],
												)
											}
										>
											<Plus className="mr-1 h-3.5 w-3.5" />
											Add
										</Button>
									)}
								</div>
								{secondaryConversionKeys.map((rowKey, index) => (
									<div key={rowKey} className="flex gap-2">
										<Input
											disabled={!canEdit}
											{...register(
												`conversionArchitecture.secondaryConversions.${index}`,
											)}
										/>
										{canEdit && secondaryConversions.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() =>
													setValue(
														"conversionArchitecture.secondaryConversions",
														secondaryConversions.filter((_, itemIndex) => itemIndex !== index),
													)
												}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
							</div>

							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label>Lead capture points</Label>
									{canEdit && (
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												setValue("conversionArchitecture.leadCapturePoints", [
													...leadCapturePoints,
													"",
												])
											}
										>
											<Plus className="mr-1 h-3.5 w-3.5" />
											Add
										</Button>
									)}
								</div>
								{leadCapturePointKeys.map((rowKey, index) => (
									<div key={rowKey} className="flex gap-2">
										<Input
											disabled={!canEdit}
											{...register(`conversionArchitecture.leadCapturePoints.${index}`)}
										/>
										{canEdit && leadCapturePoints.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() =>
													setValue(
														"conversionArchitecture.leadCapturePoints",
														leadCapturePoints.filter((_, itemIndex) => itemIndex !== index),
													)
												}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
							</div>

							<div className="grid gap-4 md:grid-cols-3">
								<div className="space-y-1.5">
									<Label htmlFor="crmPlatform">CRM platform</Label>
									<Input id="crmPlatform" disabled={!canEdit} {...register("conversionArchitecture.crmPlatform")} />
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="analyticsStack">Analytics stack</Label>
									<Input id="analyticsStack" disabled={!canEdit} {...register("conversionArchitecture.analyticsStack")} />
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="attributionModel">Attribution model</Label>
									<Input id="attributionModel" disabled={!canEdit} {...register("conversionArchitecture.attributionModel")} />
								</div>
							</div>
						</div>
					)}

					{activeStep.key === "strategicLevers" && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="text-sm text-muted-foreground">
									Define the high-impact levers for this client.
								</p>
								{canEdit && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											strategicLevers.append({
												lever: "",
												priority: "MEDIUM",
												ownerRole: null,
												notes: null,
											})
										}
									>
										<Plus className="mr-1 h-3.5 w-3.5" />
										Add lever
									</Button>
								)}
							</div>

							{errors.strategicLevers?.message && (
								<p className="text-xs text-destructive">{errors.strategicLevers.message}</p>
							)}

							{strategicLevers.fields.map((field, index) => (
								<div key={field.id} className="rounded-lg border border-border p-3 space-y-3">
									<div className="flex items-center justify-between">
										<p className="text-sm font-medium">Lever {index + 1}</p>
										{canEdit && strategicLevers.fields.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => strategicLevers.remove(index)}
											>
												<Trash2 className="mr-1 h-3.5 w-3.5" />
												Remove
											</Button>
										)}
									</div>
									<div className="grid gap-3 md:grid-cols-3">
										<div className="space-y-1.5 md:col-span-2">
											<Label>Lever</Label>
											<Input disabled={!canEdit} {...register(`strategicLevers.${index}.lever`)} />
											{errors.strategicLevers?.[index]?.lever && (
												<p className="text-xs text-destructive">
													{errors.strategicLevers[index]?.lever?.message}
												</p>
											)}
										</div>
										<div className="space-y-1.5">
											<Label>Priority</Label>
											<select
												disabled={!canEdit}
												className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
												{...register(`strategicLevers.${index}.priority`)}
											>
												<option value="HIGH">High</option>
												<option value="MEDIUM">Medium</option>
												<option value="LOW">Low</option>
											</select>
										</div>
										<div className="space-y-1.5">
											<Label>Owner role</Label>
											<Input disabled={!canEdit} {...register(`strategicLevers.${index}.ownerRole`)} />
										</div>
									</div>
									<div className="space-y-1.5">
										<Label>Notes</Label>
										<textarea
											rows={3}
											disabled={!canEdit}
											className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
											{...register(`strategicLevers.${index}.notes`)}
										/>
									</div>
								</div>
							))}
						</div>
					)}

					{activeStep.key === "competitors" && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<p className="text-sm text-muted-foreground">
									Capture primary competitors and market notes.
								</p>
								{canEdit && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() =>
											competitors.append({
												name: "",
												domain: null,
												positioning: null,
												strengths: null,
												weaknesses: null,
											})
										}
									>
										<Plus className="mr-1 h-3.5 w-3.5" />
										Add competitor
									</Button>
								)}
							</div>

							{errors.competitors?.message && (
								<p className="text-xs text-destructive">{errors.competitors.message}</p>
							)}

							{competitors.fields.map((field, index) => (
								<div key={field.id} className="rounded-lg border border-border p-3 space-y-3">
									<div className="flex items-center justify-between">
										<p className="text-sm font-medium">Competitor {index + 1}</p>
										{canEdit && competitors.fields.length > 1 && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => competitors.remove(index)}
											>
												<Trash2 className="mr-1 h-3.5 w-3.5" />
												Remove
											</Button>
										)}
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="space-y-1.5">
											<Label>Name</Label>
											<Input disabled={!canEdit} {...register(`competitors.${index}.name`)} />
											{errors.competitors?.[index]?.name && (
												<p className="text-xs text-destructive">
													{errors.competitors[index]?.name?.message}
												</p>
											)}
										</div>
										<div className="space-y-1.5">
											<Label>Domain</Label>
											<Input disabled={!canEdit} {...register(`competitors.${index}.domain`)} />
										</div>
										<div className="space-y-1.5 md:col-span-2">
											<Label>Positioning</Label>
											<Input disabled={!canEdit} {...register(`competitors.${index}.positioning`)} />
										</div>
										<div className="space-y-1.5">
											<Label>Strengths</Label>
											<textarea
												rows={3}
												disabled={!canEdit}
												className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
												{...register(`competitors.${index}.strengths`)}
											/>
										</div>
										<div className="space-y-1.5">
											<Label>Weaknesses</Label>
											<textarea
												rows={3}
												disabled={!canEdit}
												className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
												{...register(`competitors.${index}.weaknesses`)}
											/>
										</div>
									</div>
								</div>
							))}
						</div>
					)}

					{activeStep.key === "currentStateBaseline" && (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="monthlyOrganicSessions">Monthly organic sessions</Label>
								<Input
									id="monthlyOrganicSessions"
									type="number"
									disabled={!canEdit}
									{...register("currentStateBaseline.monthlyOrganicSessions", {
										setValueAs: parseIntegerOrNull,
									})}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="monthlyLeads">Monthly leads</Label>
								<Input
									id="monthlyLeads"
									type="number"
									disabled={!canEdit}
									{...register("currentStateBaseline.monthlyLeads", {
										setValueAs: parseIntegerOrNull,
									})}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="leadToCustomerRate">Lead to customer rate (%)</Label>
								<Input
									id="leadToCustomerRate"
									type="number"
									disabled={!canEdit}
									{...register("currentStateBaseline.leadToCustomerRate", {
										setValueAs: parseNumberOrNull,
									})}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="closeRate">Close rate (%)</Label>
								<Input
									id="closeRate"
									type="number"
									disabled={!canEdit}
									{...register("currentStateBaseline.closeRate", {
										setValueAs: parseNumberOrNull,
									})}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="averageOrderValue">Average order value</Label>
								<Input
									id="averageOrderValue"
									type="number"
									disabled={!canEdit}
									{...register("currentStateBaseline.averageOrderValue", {
										setValueAs: parseNumberOrNull,
									})}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="customerLifetimeValue">Customer lifetime value</Label>
								<Input
									id="customerLifetimeValue"
									type="number"
									disabled={!canEdit}
									{...register("currentStateBaseline.customerLifetimeValue", {
										setValueAs: parseNumberOrNull,
									})}
								/>
							</div>
							<div className="space-y-1.5 md:col-span-2">
								<Label htmlFor="baselineNotes">Notes</Label>
								<textarea
									id="baselineNotes"
									rows={4}
									disabled={!canEdit}
									className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
									{...register("currentStateBaseline.notes")}
								/>
							</div>
						</div>
					)}

					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
						<div className="text-xs text-muted-foreground">
							{stepErrorCount[currentStep] > 0
								? "This section has validation issues"
								: "Section looks good"}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
								disabled={currentStep === 0 || isSavingDraft || isSubmitting}
							>
								Previous
							</Button>

							{currentStep < steps.length - 1 ? (
								<Button
									type="button"
									onClick={() => void goToNextStep()}
									disabled={isSavingDraft || isSubmitting}
								>
									Next
								</Button>
							) : (
								<Button
									type="button"
									onClick={() => void handleFinalSubmit()}
									disabled={!canEdit || isSubmitting || isSavingDraft}
								>
									{isSubmitting ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Send className="mr-2 h-4 w-4" />
									)}
									Submit onboarding
								</Button>
							)}

							<Button
								type="button"
								variant="secondary"
								onClick={() => void handleSaveDraft()}
								disabled={!canEdit || isSavingDraft || isSubmitting}
							>
								{isSavingDraft ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Save className="mr-2 h-4 w-4" />
								)}
								Save draft
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
