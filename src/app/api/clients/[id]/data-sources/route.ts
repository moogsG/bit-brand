import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataSources, clients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";

const dataSourceTypes = [
	"GA4",
	"GSC",
	"MOZ",
	"DATAFORSEO",
	"RANKSCALE",
] as const;

const upsertDataSourceSchema = z.object({
	type: z.enum(dataSourceTypes),
	propertyIdentifier: z.string().optional().nullable(),
	isConnected: z.boolean().optional(),
});

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const accessContext = await getClientAccessContext(session, id);

	if (!can("dataSources", "view", { session, clientId: id, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	// Verify client exists
	const client = await db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.id, id))
		.get();

	if (!client) {
		return NextResponse.json({ error: "Client not found" }, { status: 404 });
	}

	const sources = await db
		.select()
		.from(dataSources)
		.where(eq(dataSources.clientId, id));

	return NextResponse.json(sources);
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const accessContext = await getClientAccessContext(session, id);

	if (!can("dataSources", "edit", { session, clientId: id, ...accessContext })) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await req.json();
		const parsed = upsertDataSourceSchema.parse(body);

		// Verify client exists
		const client = await db
			.select({ id: clients.id })
			.from(clients)
			.where(eq(clients.id, id))
			.get();

		if (!client) {
			return NextResponse.json({ error: "Client not found" }, { status: 404 });
		}

		// Check if data source of this type already exists for client
		const existing = await db
			.select({ id: dataSources.id })
			.from(dataSources)
			.where(
				and(eq(dataSources.clientId, id), eq(dataSources.type, parsed.type)),
			)
			.get();

		if (existing) {
			// Update existing
			const [updated] = await db
				.update(dataSources)
				.set({
					propertyIdentifier: parsed.propertyIdentifier ?? null,
					isConnected: parsed.isConnected ?? false,
					updatedAt: new Date(),
				})
				.where(eq(dataSources.id, existing.id))
				.returning();
			return NextResponse.json(updated);
		}

		// Insert new
		const [created] = await db
			.insert(dataSources)
			.values({
				clientId: id,
				type: parsed.type,
				propertyIdentifier: parsed.propertyIdentifier ?? null,
				isConnected: parsed.isConnected ?? false,
			})
			.returning();

		return NextResponse.json(created, { status: 201 });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to save data source";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
