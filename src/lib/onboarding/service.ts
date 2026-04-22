import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	clientOnboardingProfiles,
	onboardingBusinessFundamentals,
	onboardingCompetitors,
	onboardingConversionArchitecture,
	onboardingCurrentStateBaselines,
	onboardingNorthStarGoals,
	onboardingStrategicLevers,
} from "@/lib/db/schema";
import {
	buildEmptyOnboardingProfile,
	type OnboardingProfileInput,
	type OnboardingProfileResponse,
} from "./types";

interface SaveOnboardingOptions {
	createNewVersion?: boolean;
	version?: number;
}

function parseJsonArray(value: string | null): string[] {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.filter((item): item is string => typeof item === "string")
			: [];
	} catch {
		return [];
	}
}

async function getProfileRecord(clientId: string, version?: number) {
	if (version) {
		return db
			.select()
			.from(clientOnboardingProfiles)
			.where(
				and(
					eq(clientOnboardingProfiles.clientId, clientId),
					eq(clientOnboardingProfiles.version, version),
				),
			)
			.get();
	}

	return db
		.select()
		.from(clientOnboardingProfiles)
		.where(eq(clientOnboardingProfiles.clientId, clientId))
		.orderBy(desc(clientOnboardingProfiles.version))
		.get();
}

export async function ensureOnboardingDraftProfile(
	clientId: string,
	actorUserId: string,
): Promise<void> {
	const existing = await getProfileRecord(clientId);
	if (existing) {
		return;
	}

	await db.insert(clientOnboardingProfiles).values({
		clientId,
		version: 1,
		status: "DRAFT",
		createdBy: actorUserId,
		updatedBy: actorUserId,
	});
}

export async function isOnboardingComplete(clientId: string): Promise<boolean> {
	const profile = await getProfileRecord(clientId);
	return profile?.status === "COMPLETED";
}

export async function getOnboardingProfile(
	clientId: string,
	version?: number,
): Promise<OnboardingProfileResponse> {
	const profile = await getProfileRecord(clientId, version);
	if (!profile) {
		return buildEmptyOnboardingProfile(clientId);
	}

	const [business, northStar, conversion, levers, competitors, baseline] =
		await Promise.all([
			db
				.select()
				.from(onboardingBusinessFundamentals)
				.where(eq(onboardingBusinessFundamentals.profileId, profile.id))
				.get(),
			db
				.select()
				.from(onboardingNorthStarGoals)
				.where(eq(onboardingNorthStarGoals.profileId, profile.id))
				.get(),
			db
				.select()
				.from(onboardingConversionArchitecture)
				.where(eq(onboardingConversionArchitecture.profileId, profile.id))
				.get(),
			db
				.select()
				.from(onboardingStrategicLevers)
				.where(eq(onboardingStrategicLevers.profileId, profile.id))
				.orderBy(onboardingStrategicLevers.position)
				.all(),
			db
				.select()
				.from(onboardingCompetitors)
				.where(eq(onboardingCompetitors.profileId, profile.id))
				.orderBy(onboardingCompetitors.position)
				.all(),
			db
				.select()
				.from(onboardingCurrentStateBaselines)
				.where(eq(onboardingCurrentStateBaselines.profileId, profile.id))
				.get(),
		]);

	return {
		clientId,
		profile: {
			id: profile.id,
			version: profile.version,
			status: profile.status,
			completedAt: profile.completedAt,
			createdAt: profile.createdAt,
			updatedAt: profile.updatedAt,
		},
		businessFundamentals: business
			? {
					businessName: business.businessName,
					domain: business.domain,
					industry: business.industry,
					targetGeo: business.targetGeo,
					primaryOffer: business.primaryOffer,
					idealCustomer: business.idealCustomer,
					pricingModel: business.pricingModel,
					salesCycleDays: business.salesCycleDays,
					notes: business.notes,
				}
			: null,
		northStarGoal: northStar
			? {
					statement: northStar.statement,
					metricName: northStar.metricName,
					currentValue: northStar.currentValue,
					targetValue: northStar.targetValue,
					targetDate: northStar.targetDate,
					timeHorizonMonths: northStar.timeHorizonMonths,
					confidenceNotes: northStar.confidenceNotes,
				}
			: null,
		conversionArchitecture: conversion
			? {
					primaryConversion: conversion.primaryConversion,
					secondaryConversions: parseJsonArray(conversion.secondaryConversions),
					leadCapturePoints: parseJsonArray(conversion.leadCapturePoints),
					crmPlatform: conversion.crmPlatform,
					analyticsStack: conversion.analyticsStack,
					attributionModel: conversion.attributionModel,
				}
			: null,
		strategicLevers: levers.map((lever) => ({
			lever: lever.lever,
			priority: lever.priority,
			ownerRole: lever.ownerRole,
			notes: lever.notes,
		})),
		competitors: competitors.map((competitor) => ({
			name: competitor.name,
			domain: competitor.domain,
			positioning: competitor.positioning,
			strengths: competitor.strengths,
			weaknesses: competitor.weaknesses,
		})),
		currentStateBaseline: baseline
			? {
					monthlyOrganicSessions: baseline.monthlyOrganicSessions,
					monthlyLeads: baseline.monthlyLeads,
					leadToCustomerRate: baseline.leadToCustomerRate,
					closeRate: baseline.closeRate,
					averageOrderValue: baseline.averageOrderValue,
					customerLifetimeValue: baseline.customerLifetimeValue,
					notes: baseline.notes,
				}
			: null,
	};
}

async function upsertBusinessFundamentals(
	profileId: string,
	input: NonNullable<OnboardingProfileInput["businessFundamentals"]>,
) {
	const existing = await db
		.select({ id: onboardingBusinessFundamentals.id })
		.from(onboardingBusinessFundamentals)
		.where(eq(onboardingBusinessFundamentals.profileId, profileId))
		.get();

	if (existing) {
		await db
			.update(onboardingBusinessFundamentals)
			.set(input)
			.where(eq(onboardingBusinessFundamentals.profileId, profileId));
		return;
	}

	await db
		.insert(onboardingBusinessFundamentals)
		.values({ profileId, ...input });
}

async function upsertNorthStarGoal(
	profileId: string,
	input: NonNullable<OnboardingProfileInput["northStarGoal"]>,
) {
	const existing = await db
		.select({ id: onboardingNorthStarGoals.id })
		.from(onboardingNorthStarGoals)
		.where(eq(onboardingNorthStarGoals.profileId, profileId))
		.get();

	if (existing) {
		await db
			.update(onboardingNorthStarGoals)
			.set(input)
			.where(eq(onboardingNorthStarGoals.profileId, profileId));
		return;
	}

	await db.insert(onboardingNorthStarGoals).values({ profileId, ...input });
}

async function upsertConversionArchitecture(
	profileId: string,
	input: NonNullable<OnboardingProfileInput["conversionArchitecture"]>,
) {
	const existing = await db
		.select({ id: onboardingConversionArchitecture.id })
		.from(onboardingConversionArchitecture)
		.where(eq(onboardingConversionArchitecture.profileId, profileId))
		.get();

	const payload = {
		primaryConversion: input.primaryConversion,
		secondaryConversions: JSON.stringify(input.secondaryConversions),
		leadCapturePoints: JSON.stringify(input.leadCapturePoints),
		crmPlatform: input.crmPlatform ?? null,
		analyticsStack: input.analyticsStack ?? null,
		attributionModel: input.attributionModel ?? null,
	};

	if (existing) {
		await db
			.update(onboardingConversionArchitecture)
			.set(payload)
			.where(eq(onboardingConversionArchitecture.profileId, profileId));
		return;
	}

	await db
		.insert(onboardingConversionArchitecture)
		.values({ profileId, ...payload });
}

async function replaceStrategicLevers(
	profileId: string,
	input: NonNullable<OnboardingProfileInput["strategicLevers"]>,
) {
	await db
		.delete(onboardingStrategicLevers)
		.where(eq(onboardingStrategicLevers.profileId, profileId));

	if (!input.length) {
		return;
	}

	await db.insert(onboardingStrategicLevers).values(
		input.map((lever, index) => ({
			profileId,
			lever: lever.lever,
			priority: lever.priority,
			ownerRole: lever.ownerRole ?? null,
			notes: lever.notes ?? null,
			position: index,
		})),
	);
}

async function replaceCompetitors(
	profileId: string,
	input: NonNullable<OnboardingProfileInput["competitors"]>,
) {
	await db
		.delete(onboardingCompetitors)
		.where(eq(onboardingCompetitors.profileId, profileId));

	if (!input.length) {
		return;
	}

	await db.insert(onboardingCompetitors).values(
		input.map((competitor, index) => ({
			profileId,
			name: competitor.name,
			domain: competitor.domain ?? null,
			positioning: competitor.positioning ?? null,
			strengths: competitor.strengths ?? null,
			weaknesses: competitor.weaknesses ?? null,
			position: index,
		})),
	);
}

async function upsertCurrentStateBaseline(
	profileId: string,
	input: NonNullable<OnboardingProfileInput["currentStateBaseline"]>,
) {
	const existing = await db
		.select({ id: onboardingCurrentStateBaselines.id })
		.from(onboardingCurrentStateBaselines)
		.where(eq(onboardingCurrentStateBaselines.profileId, profileId))
		.get();

	if (existing) {
		await db
			.update(onboardingCurrentStateBaselines)
			.set(input)
			.where(eq(onboardingCurrentStateBaselines.profileId, profileId));
		return;
	}

	await db
		.insert(onboardingCurrentStateBaselines)
		.values({ profileId, ...input });
}

async function applyOnboardingSections(
	profileId: string,
	input: OnboardingProfileInput,
) {
	if (input.businessFundamentals) {
		await upsertBusinessFundamentals(profileId, input.businessFundamentals);
	}

	if (input.northStarGoal) {
		await upsertNorthStarGoal(profileId, input.northStarGoal);
	}

	if (input.conversionArchitecture) {
		await upsertConversionArchitecture(profileId, input.conversionArchitecture);
	}

	if (input.strategicLevers) {
		await replaceStrategicLevers(profileId, input.strategicLevers);
	}

	if (input.competitors) {
		await replaceCompetitors(profileId, input.competitors);
	}

	if (input.currentStateBaseline) {
		await upsertCurrentStateBaseline(profileId, input.currentStateBaseline);
	}
}

export async function createOnboardingProfile(
	clientId: string,
	actorUserId: string,
	input: OnboardingProfileInput,
): Promise<OnboardingProfileResponse> {
	const latest = await getProfileRecord(clientId);
	const nextVersion = (latest?.version ?? 0) + 1;
	const nextStatus = input.status ?? "DRAFT";

	const [profile] = await db
		.insert(clientOnboardingProfiles)
		.values({
			clientId,
			version: nextVersion,
			status: nextStatus,
			completedAt: nextStatus === "COMPLETED" ? new Date() : null,
			createdBy: actorUserId,
			updatedBy: actorUserId,
		})
		.returning();

	await applyOnboardingSections(profile.id, input);

	return getOnboardingProfile(clientId, profile.version);
}

export async function updateOnboardingProfile(
	clientId: string,
	actorUserId: string,
	input: OnboardingProfileInput,
	version?: number,
): Promise<OnboardingProfileResponse> {
	const profile = await getProfileRecord(clientId, version);
	if (!profile) {
		return createOnboardingProfile(clientId, actorUserId, input);
	}

	const nextStatus = input.status ?? profile.status;

	await db
		.update(clientOnboardingProfiles)
		.set({
			status: nextStatus,
			completedAt:
				nextStatus === "COMPLETED" ? (profile.completedAt ?? new Date()) : null,
			updatedBy: actorUserId,
			updatedAt: new Date(),
		})
		.where(eq(clientOnboardingProfiles.id, profile.id));

	await applyOnboardingSections(profile.id, input);

	return getOnboardingProfile(clientId, profile.version);
}

export async function saveOnboardingProfile(
	clientId: string,
	actorUserId: string,
	input: OnboardingProfileInput,
	options: SaveOnboardingOptions = {},
): Promise<OnboardingProfileResponse> {
	if (options.createNewVersion) {
		return createOnboardingProfile(clientId, actorUserId, input);
	}

	return updateOnboardingProfile(clientId, actorUserId, input, options.version);
}
