/**
 * GET /api/auth/google?clientId={id}&source={GA4|GSC}
 *
 * Placeholder OAuth endpoint for Google Analytics / Search Console.
 * Full OAuth flow requires Google Cloud Console project setup with:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 *   - Authorized redirect URIs
 *
 * TODO: Implement full OAuth 2.0 flow when Google Cloud project is configured.
 *       Steps:
 *       1. Redirect to Google OAuth consent screen
 *       2. Handle callback at /api/auth/google/callback
 *       3. Exchange code for access + refresh tokens
 *       4. Store service account credentials in apiCredentials table
 *       5. GA4/GSC integrations already use google-auth-library with service accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const session = await auth();
	if (!session || session.user.role !== "ADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(req.url);
	const clientId = searchParams.get("clientId");
	const source = searchParams.get("source");

	if (!clientId || !source) {
		return NextResponse.json(
			{ error: "Missing required params: clientId, source" },
			{ status: 400 },
		);
	}

	if (!["GA4", "GSC"].includes(source.toUpperCase())) {
		return NextResponse.json(
			{ error: "source must be GA4 or GSC" },
			{ status: 400 },
		);
	}

	return NextResponse.json({
		message: "Google OAuth not yet configured for POC",
		source: source.toUpperCase(),
		clientId,
		instructions:
			"For POC testing: manually add an access_token to the dataSources table, or use the manual token input field in the Admin UI.",
		todo: [
			"1. Create a Google Cloud project at https://console.cloud.google.com",
			"2. Enable the Google Analytics Data API and Search Console API",
			"3. Create OAuth 2.0 credentials (Web application type)",
			"4. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local",
			"5. Implement this endpoint to redirect to Google OAuth consent screen",
			"6. Create /api/auth/google/callback to handle the OAuth code exchange",
		],
	});
}
