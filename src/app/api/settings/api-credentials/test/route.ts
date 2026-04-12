import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiCredentials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { provider } = await request.json();

	if (!provider) {
		return NextResponse.json({ error: "provider required" }, { status: 400 });
	}

	const credential = db
		.select()
		.from(apiCredentials)
		.where(
			and(
				eq(apiCredentials.provider, provider),
				eq(apiCredentials.isActive, true),
			),
		)
		.get();

	if (!credential) {
		return NextResponse.json({
			success: false,
			message: `No active ${provider} credential found`,
		});
	}

	let creds: Record<string, string>;
	try {
		creds = JSON.parse(decrypt(credential.credentialsEnc));
	} catch {
		return NextResponse.json({
			success: false,
			message: "Failed to decrypt credentials",
		});
	}

	try {
		let message = "";

		switch (provider) {
			case "GA4":
			case "GSC": {
				// Validate service account JSON structure
				if (!creds.serviceAccountEmail || !creds.privateKey) {
					return NextResponse.json({
						success: false,
						message: "Missing serviceAccountEmail or privateKey",
					});
				}
				message = `Service account ${creds.serviceAccountEmail} validated (structure check only)`;
				break;
			}
			case "MOZ": {
				if (!creds.accessId || !creds.secretKey) {
					return NextResponse.json({
						success: false,
						message: "Missing accessId or secretKey",
					});
				}
				// Attempt a real API call to Moz
				const mozAuth = Buffer.from(
					`${creds.accessId}:${creds.secretKey}`,
				).toString("base64");
				const mozResp = await fetch("https://lsapi.seomoz.com/v2/url_metrics", {
					method: "POST",
					headers: {
						Authorization: `Basic ${mozAuth}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ targets: ["moz.com"] }),
				});
				if (!mozResp.ok) {
					const errText = await mozResp.text();
					return NextResponse.json({
						success: false,
						message: `Moz API error: ${mozResp.status} ${errText}`,
					});
				}
				message = "Moz API connection successful";
				break;
			}
			case "DATAFORSEO": {
				if (!creds.login || !creds.password) {
					return NextResponse.json({
						success: false,
						message: "Missing login or password",
					});
				}
				const dfAuth = Buffer.from(`${creds.login}:${creds.password}`).toString(
					"base64",
				);
				const dfResp = await fetch(
					"https://api.dataforseo.com/v3/appendix/user_data",
					{
						headers: { Authorization: `Basic ${dfAuth}` },
					},
				);
				if (!dfResp.ok) {
					return NextResponse.json({
						success: false,
						message: `DataForSEO API error: ${dfResp.status}`,
					});
				}
				message = "DataForSEO API connection successful";
				break;
			}
			case "RANKSCALE": {
				if (!creds.apiKey) {
					return NextResponse.json({
						success: false,
						message: "Missing apiKey",
					});
				}
				message =
					"Rankscale API key saved (endpoint unverified — confirm with vendor)";
				break;
			}
			default:
				return NextResponse.json({
					success: false,
					message: `Unknown provider: ${provider}`,
				});
		}

		// Update lastTestedAt
		db.update(apiCredentials)
			.set({ lastTestedAt: new Date() })
			.where(eq(apiCredentials.id, credential.id))
			.run();

		return NextResponse.json({ success: true, message });
	} catch (error) {
		const msg = error instanceof Error ? error.message : "Unknown error";
		return NextResponse.json({
			success: false,
			message: `Connection test failed: ${msg}`,
		});
	}
}
