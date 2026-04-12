import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { NextResponse } from "next/server";

export async function GET() {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const creds = db.select().from(apiCredentials).all();

	// Mask credentials for display
	const masked = creds.map((c) => {
		let parsed: Record<string, string> = {};
		try {
			parsed = JSON.parse(decrypt(c.credentialsEnc));
		} catch {
			parsed = { error: "Could not decrypt" };
		}

		const maskedCreds: Record<string, string> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "string" && value.length > 8) {
				maskedCreds[key] = value.slice(0, 4) + "****" + value.slice(-4);
			} else {
				maskedCreds[key] = "****";
			}
		}

		return {
			id: c.id,
			provider: c.provider,
			credentials: maskedCreds,
			label: c.label,
			isActive: c.isActive,
			lastTestedAt: c.lastTestedAt,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
		};
	});

	return NextResponse.json(masked);
}

export async function POST(request: Request) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const { provider, credentials, label } = body;

	if (!provider || !credentials) {
		return NextResponse.json(
			{ error: "provider and credentials required" },
			{ status: 400 },
		);
	}

	const validProviders = ["GA4", "GSC", "MOZ", "DATAFORSEO", "RANKSCALE"];
	if (!validProviders.includes(provider)) {
		return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
	}

	const credentialsEnc = encrypt(JSON.stringify(credentials));

	// Upsert by provider
	const existing = db
		.select()
		.from(apiCredentials)
		.where(eq(apiCredentials.provider, provider))
		.get();

	if (existing) {
		db.update(apiCredentials)
			.set({
				credentialsEnc,
				label: label || existing.label,
				updatedAt: new Date(),
			})
			.where(eq(apiCredentials.id, existing.id))
			.run();
	} else {
		db.insert(apiCredentials)
			.values({
				provider,
				credentialsEnc,
				label,
			})
			.run();
	}

	return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const provider = searchParams.get("provider");

	const validProviders = [
		"GA4",
		"GSC",
		"MOZ",
		"DATAFORSEO",
		"RANKSCALE",
	] as const;
	type ProviderType = (typeof validProviders)[number];

	if (!provider || !validProviders.includes(provider as ProviderType)) {
		return NextResponse.json(
			{ error: "Valid provider required" },
			{ status: 400 },
		);
	}

	db.delete(apiCredentials)
		.where(eq(apiCredentials.provider, provider as ProviderType))
		.run();

	return NextResponse.json({ success: true });
}
