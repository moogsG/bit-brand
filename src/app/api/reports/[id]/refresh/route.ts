import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { monthlyReports } from "@/lib/db/schema";
import { getReportAutoData } from "@/lib/reports/auto-data";

export async function POST(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;

	const report = await db
		.select()
		.from(monthlyReports)
		.where(eq(monthlyReports.id, id))
		.get();

	if (!report) {
		return NextResponse.json({ error: "Report not found" }, { status: 404 });
	}

	const accessContext = await getClientAccessContext(session, report.clientId);
	if (
		!can("reports", "edit", {
			session,
			clientId: report.clientId,
			...accessContext,
		})
	) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const autoData = await getReportAutoData(
			report.clientId,
			report.month,
			report.year,
		);

		return NextResponse.json({ autoData });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to refresh data";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
