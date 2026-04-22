import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { keywordResearch } from "@/lib/db/schema";

const updateKeywordSchema = z.object({
	keyword: z.string().min(1).optional(),
	monthlyVolume: z.number().int().nonnegative().optional().nullable(),
	difficulty: z.number().int().min(0).max(100).optional().nullable(),
	intent: z
		.enum(["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"])
		.optional()
		.nullable(),
	priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
	currentPosition: z.number().int().nonnegative().optional().nullable(),
	targetPosition: z.number().int().nonnegative().optional().nullable(),
	targetUrl: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
	tags: z.array(z.string()).optional().nullable(),
	status: z.enum(["OPPORTUNITY", "TARGETING", "RANKING", "WON"]).optional(),
});

export async function PATCH(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	const keyword = await db
		.select({ id: keywordResearch.id, clientId: keywordResearch.clientId })
		.from(keywordResearch)
		.where(eq(keywordResearch.id, id))
		.get();

	if (!keyword) {
		return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
	}

	const accessContext = await getClientAccessContext(session, keyword.clientId);

	if (
		!can("keywords", "edit", {
			session,
			clientId: keyword.clientId,
			...accessContext,
		})
	) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = (await req.json()) as unknown;
		const parsed = updateKeywordSchema.parse(body);

		const updateData: Record<string, unknown> = {
			...parsed,
			updatedAt: new Date(),
		};

		if (parsed.tags !== undefined) {
			updateData.tags = parsed.tags ? JSON.stringify(parsed.tags) : null;
		}

		const [updated] = await db
			.update(keywordResearch)
			.set(updateData)
			.where(eq(keywordResearch.id, id))
			.returning();

		if (!updated) {
			return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
		}

		return NextResponse.json(updated);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to update keyword";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	const keyword = await db
		.select({ id: keywordResearch.id, clientId: keywordResearch.clientId })
		.from(keywordResearch)
		.where(eq(keywordResearch.id, id))
		.get();

	if (!keyword) {
		return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
	}

	const accessContext = await getClientAccessContext(session, keyword.clientId);

	if (
		!can("keywords", "edit", {
			session,
			clientId: keyword.clientId,
			...accessContext,
		})
	) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const [deleted] = await db
		.delete(keywordResearch)
		.where(eq(keywordResearch.id, id))
		.returning();

	if (!deleted) {
		return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
	}

	return NextResponse.json({ success: true });
}
