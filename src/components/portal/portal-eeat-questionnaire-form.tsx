"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PortalEeatQuestionnaireFormProps {
	clientId: string;
}

interface QuestionnaireField {
	key: string;
	label: string;
	type: "text" | "textarea" | "number" | "boolean" | "select";
	required: boolean;
	options: string[];
}

interface QuestionnaireRecord {
	id: string;
	contentType: string;
	schema: string;
	version: number;
	isActive: boolean;
	updatedAt: string | Date;
}

interface ApiEnvelope<TData> {
	success: boolean;
	data: TData;
	error: {
		code: string;
		message: string;
	} | null;
}

function safeJsonParse(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return {};
	} catch {
		return {};
	}
}

function normalizeFieldType(value: unknown): QuestionnaireField["type"] {
	if (typeof value !== "string") {
		return "textarea";
	}

	switch (value.trim().toLowerCase()) {
		case "text":
		case "string":
			return "text";
		case "number":
		case "numeric":
			return "number";
		case "boolean":
		case "checkbox":
			return "boolean";
		case "select":
		case "dropdown":
			return "select";
		default:
			return "textarea";
	}
}

function normalizeOptions(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((item) => {
			if (typeof item === "string") {
				return item.trim();
			}
			if (item && typeof item === "object") {
				const label = (item as Record<string, unknown>).label;
				if (typeof label === "string") {
					return label.trim();
				}
				const optionValue = (item as Record<string, unknown>).value;
				if (typeof optionValue === "string") {
					return optionValue.trim();
				}
			}
			return "";
		})
		.filter((item) => item.length > 0);
}

function coerceField(
	value: unknown,
	fallbackLabel: string,
	index: number,
): QuestionnaireField | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	const keyCandidate =
		typeof candidate.key === "string"
			? candidate.key
			: typeof candidate.id === "string"
				? candidate.id
				: typeof candidate.name === "string"
					? candidate.name
					: `field_${index + 1}`;

	const key = keyCandidate.trim();
	if (!key) {
		return null;
	}

	const labelCandidate =
		typeof candidate.label === "string"
			? candidate.label
			: typeof candidate.prompt === "string"
				? candidate.prompt
				: fallbackLabel;

	const label = labelCandidate.trim() || key;

	return {
		key,
		label,
		type: normalizeFieldType(candidate.type),
		required: Boolean(candidate.required),
		options: normalizeOptions(candidate.options),
	};
}

function extractQuestionnaireFields(schemaJson: string): QuestionnaireField[] {
	const schema = safeJsonParse(schemaJson);
	const fields: QuestionnaireField[] = [];

	const questions = Array.isArray(schema.questions) ? schema.questions : [];
	for (const [index, question] of questions.entries()) {
		const field = coerceField(question, `Question ${index + 1}`, index);
		if (field) {
			fields.push(field);
		}
	}

	const sections = Array.isArray(schema.sections) ? schema.sections : [];
	for (const [sectionIndex, section] of sections.entries()) {
		if (!section || typeof section !== "object" || Array.isArray(section)) {
			continue;
		}

		const sectionRecord = section as Record<string, unknown>;
		const sectionName =
			typeof sectionRecord.title === "string"
				? sectionRecord.title
				: `Section ${sectionIndex + 1}`;

		const sectionQuestions = Array.isArray(sectionRecord.questions)
			? sectionRecord.questions
			: [];

		for (const [index, question] of sectionQuestions.entries()) {
			const field = coerceField(
				question,
				`${sectionName} - Question ${index + 1}`,
				index,
			);
			if (field) {
				fields.push(field);
			}
		}
	}

	const deduped = new Map<string, QuestionnaireField>();
	for (const field of fields) {
		if (!deduped.has(field.key)) {
			deduped.set(field.key, field);
		}
	}

	return [...deduped.values()];
}

function valueToResponseValue(
	field: QuestionnaireField,
	value: string,
): string | number | boolean {
	if (field.type === "number") {
		return Number(value);
	}

	if (field.type === "boolean") {
		return value === "true";
	}

	return value;
}

export function PortalEeatQuestionnaireForm({
	clientId,
}: PortalEeatQuestionnaireFormProps) {
	const [questionnaires, setQuestionnaires] = useState<QuestionnaireRecord[]>([]);
	const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState("");
	const [values, setValues] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function loadQuestionnaires() {
			setIsLoading(true);
			setErrorMessage(null);

			try {
				const response = await fetch(
					`/api/eeat/questionnaires?clientId=${encodeURIComponent(clientId)}`,
					{ cache: "no-store" },
				);

				const payload = (await response.json()) as ApiEnvelope<
					QuestionnaireRecord[]
				>;

				if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
					throw new Error(
						payload.error?.message ?? "Failed to load questionnaires",
					);
				}

				if (cancelled) {
					return;
				}

				setQuestionnaires(payload.data);
				const defaultQuestionnaire =
					payload.data.find((item) => item.isActive) ?? payload.data[0] ?? null;
				setSelectedQuestionnaireId(defaultQuestionnaire?.id ?? "");
			} catch (error) {
				if (cancelled) {
					return;
				}
				setErrorMessage(
					error instanceof Error
						? error.message
						: "Failed to load questionnaires",
				);
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		void loadQuestionnaires();

		return () => {
			cancelled = true;
		};
	}, [clientId]);

	const selectedQuestionnaire = useMemo(
		() =>
			questionnaires.find((item) => item.id === selectedQuestionnaireId) ?? null,
		[questionnaires, selectedQuestionnaireId],
	);

	const fields = useMemo(() => {
		if (!selectedQuestionnaire) {
			return [];
		}
		return extractQuestionnaireFields(selectedQuestionnaire.schema);
	}, [selectedQuestionnaire]);

	useEffect(() => {
		setValues((prev) => {
			const next: Record<string, string> = {};
			for (const field of fields) {
				next[field.key] = prev[field.key] ?? "";
			}
			return next;
		});
	}, [fields]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setErrorMessage(null);
		setSuccessMessage(null);

		if (!selectedQuestionnaire) {
			setErrorMessage("Select a questionnaire before submitting.");
			return;
		}

		const responses: Record<string, string | number | boolean> = {};
		for (const field of fields) {
			const rawValue = values[field.key] ?? "";
			const trimmed = rawValue.trim();

			if (field.required && trimmed.length === 0) {
				setErrorMessage(`\"${field.label}\" is required.`);
				return;
			}

			if (trimmed.length === 0) {
				continue;
			}

			if (field.type === "number" && Number.isNaN(Number(trimmed))) {
				setErrorMessage(`\"${field.label}\" must be a number.`);
				return;
			}

			responses[field.key] = valueToResponseValue(field, trimmed);
		}

		if (Object.keys(responses).length === 0) {
			setErrorMessage("Provide at least one response before submitting.");
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/eeat/responses", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					clientId,
					questionnaireId: selectedQuestionnaire.id,
					responses,
				}),
			});

			const payload = (await response.json()) as ApiEnvelope<unknown>;
			if (!response.ok || !payload.success) {
				throw new Error(payload.error?.message ?? "Failed to submit responses");
			}

			setSuccessMessage("Responses submitted.");
			setValues((prev) => {
				const cleared: Record<string, string> = { ...prev };
				for (const field of fields) {
					cleared[field.key] = "";
				}
				return cleared;
			});
		} catch (error) {
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to submit responses",
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card>
			<CardHeader className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<CardTitle>EEAT Questionnaire</CardTitle>
					{selectedQuestionnaire?.isActive ? <Badge>Active</Badge> : null}
				</div>
				<p className="text-sm text-muted-foreground">
					Submit your latest EEAT details so the content team can score and action
					recommendations.
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading questionnaires...</p>
				) : null}

				{!isLoading && questionnaires.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No questionnaire is available for this client yet.
					</p>
				) : null}

				{errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
				{successMessage ? (
					<p className="text-sm text-emerald-600">{successMessage}</p>
				) : null}

				{questionnaires.length > 0 ? (
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="questionnaire-id">Questionnaire</Label>
							<select
								id="questionnaire-id"
								className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
								value={selectedQuestionnaireId}
								onChange={(event) => {
									setSelectedQuestionnaireId(event.target.value);
									setErrorMessage(null);
									setSuccessMessage(null);
								}}
							>
								{questionnaires.map((item) => (
									<option key={item.id} value={item.id}>
										{item.contentType} v{item.version}
										{item.isActive ? " (active)" : ""}
									</option>
								))}
							</select>
						</div>

						{fields.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								The selected questionnaire does not expose structured fields yet.
							</p>
						) : (
							<div className="space-y-4">
								{fields.map((field) => {
									const value = values[field.key] ?? "";

									if (field.type === "textarea") {
										return (
											<div key={field.key} className="space-y-2">
												<Label htmlFor={field.key}>
													{field.label}
													{field.required ? " *" : ""}
												</Label>
												<Textarea
													id={field.key}
													value={value}
													onChange={(event) =>
														setValues((prev) => ({
															...prev,
															[field.key]: event.target.value,
														}))
													}
												/>
											</div>
										);
									}

									if (field.type === "select") {
										return (
											<div key={field.key} className="space-y-2">
												<Label htmlFor={field.key}>
													{field.label}
													{field.required ? " *" : ""}
												</Label>
												<select
													id={field.key}
													className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
													value={value}
													onChange={(event) =>
														setValues((prev) => ({
															...prev,
															[field.key]: event.target.value,
														}))
													}
												>
													<option value="">Select an option</option>
													{field.options.map((option) => (
														<option key={option} value={option}>
															{option}
														</option>
													))}
												</select>
											</div>
										);
									}

									if (field.type === "boolean") {
										return (
											<div key={field.key} className="space-y-2">
												<Label htmlFor={field.key}>
													{field.label}
													{field.required ? " *" : ""}
												</Label>
												<select
													id={field.key}
													className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
													value={value}
													onChange={(event) =>
														setValues((prev) => ({
															...prev,
															[field.key]: event.target.value,
														}))
													}
												>
													<option value="">Select yes/no</option>
													<option value="true">Yes</option>
													<option value="false">No</option>
												</select>
											</div>
										);
									}

									return (
										<div key={field.key} className="space-y-2">
											<Label htmlFor={field.key}>
												{field.label}
												{field.required ? " *" : ""}
											</Label>
											<Input
												id={field.key}
												type={field.type === "number" ? "number" : "text"}
												value={value}
												onChange={(event) =>
													setValues((prev) => ({
														...prev,
														[field.key]: event.target.value,
													}))
												}
											/>
										</div>
									);
								})}
							</div>
						)}

						<div className="flex justify-end">
							<Button type="submit" disabled={isSubmitting || isLoading}>
								{isSubmitting ? "Submitting..." : "Submit responses"}
							</Button>
						</div>
					</form>
				) : null}
			</CardContent>
		</Card>
	);
}
