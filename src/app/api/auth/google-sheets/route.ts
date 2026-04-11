import { NextResponse } from "next/server";

/**
 * GET /api/auth/google-sheets
 *
 * Placeholder for Google OAuth flow with Sheets scope.
 * To implement fully, configure a Google OAuth client with:
 *   - Scope: https://www.googleapis.com/auth/spreadsheets
 *   - Redirect URI: {APP_URL}/api/auth/google-sheets/callback
 *
 * Required env vars (not yet configured):
 *   GOOGLE_SHEETS_CLIENT_ID
 *   GOOGLE_SHEETS_CLIENT_SECRET
 */
export async function GET() {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Google Sheets OAuth not configured",
        instructions: [
          "1. Create a Google Cloud project at https://console.cloud.google.com",
          "2. Enable the Google Sheets API",
          "3. Create OAuth 2.0 credentials (Web application type)",
          "4. Add your redirect URI: {APP_URL}/api/auth/google-sheets/callback",
          "5. Set env vars: GOOGLE_SHEETS_CLIENT_ID and GOOGLE_SHEETS_CLIENT_SECRET",
        ],
      },
      { status: 501 }
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const redirectUri = `${baseUrl}/api/auth/google-sheets/callback`;
  const scope = "https://www.googleapis.com/auth/spreadsheets";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url.toString());
}
