import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const updateProfileSchema = z.object({
	name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
	avatarUrl: z.union([
		z.string().trim().url("Profile photo must be a valid URL").max(2048),
		z.literal(""),
		z.null(),
	]),
});

export async function GET() {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			avatarUrl: users.avatarUrl,
		})
		.from(users)
		.where(eq(users.id, session.user.id))
		.get();

	if (!user) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	return NextResponse.json({ profile: user });
}

export async function PATCH(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const parsed = updateProfileSchema.parse(body);

		const avatarUrl =
			parsed.avatarUrl && parsed.avatarUrl.length > 0 ? parsed.avatarUrl : null;

		await db
			.update(users)
			.set({
				name: parsed.name,
				avatarUrl,
				updatedAt: new Date(),
			})
			.where(eq(users.id, session.user.id));

		return NextResponse.json({
			success: true,
			profile: {
				name: parsed.name,
				email: session.user.email ?? null,
				avatarUrl,
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = JSON.parse(error.message) as { message: string }[];
			return NextResponse.json(
				{ error: issues[0]?.message ?? "Invalid request" },
				{ status: 400 },
			);
		}

		const message =
			error instanceof Error ? error.message : "Failed to update profile";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
