import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiCredentials } from "@/lib/db/schema";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/crypto";
import { ApiCredentialsForm } from "@/components/admin/api-credentials-form";

export default async function ApiCredentialsPage() {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") redirect("/login");

	const creds = db.select().from(apiCredentials).all();

	const masked = creds.map((c) => {
		let parsed: Record<string, string> = {};
		try {
			parsed = JSON.parse(decrypt(c.credentialsEnc));
		} catch {
			parsed = {};
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
			provider: c.provider,
			credentials: maskedCreds,
			isActive: c.isActive,
			lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
		};
	});

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">API Credentials</h1>
				<p className="text-muted-foreground">
					Manage agency-level API credentials shared across all clients.
				</p>
			</div>
			<ApiCredentialsForm initialCredentials={masked} />
		</div>
	);
}
