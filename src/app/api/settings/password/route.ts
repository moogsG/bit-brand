import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function PATCH(req: NextRequest) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await req.json();
		const parsed = changePasswordSchema.parse(body);

		// Fetch the current user record to verify existing password
		const user = await db
			.select()
			.from(users)
			.where(eq(users.id, session.user.id))
			.get();

		if (!user || !user.passwordHash) {
			return NextResponse.json(
				{ error: "User account not found or has no password set." },
				{ status: 400 },
			);
		}

		const isValid = await bcrypt.compare(
			parsed.currentPassword,
			user.passwordHash,
		);
		if (!isValid) {
			return NextResponse.json(
				{ error: "Current password is incorrect." },
				{ status: 400 },
			);
		}

		const newHash = await bcrypt.hash(parsed.newPassword, 12);

		await db
			.update(users)
			.set({ passwordHash: newHash, updatedAt: new Date() })
			.where(eq(users.id, session.user.id));

		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = JSON.parse(error.message) as { message: string }[];
			return NextResponse.json(
				{ error: issues[0]?.message ?? "Invalid request" },
				{ status: 400 },
			);
		}
		const message =
			error instanceof Error ? error.message : "Failed to change password";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
