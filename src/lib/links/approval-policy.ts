import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { approvalPolicies } from "@/lib/db/schema";

export const LINK_OUTREACH_SEND_APPROVAL_POLICY_NAME =
	"link_outreach_send" as const;
export const LINK_OUTREACH_RESOURCE_TYPE = "LINK_OUTREACH_DRAFT" as const;
export const LINK_OUTREACH_SEND_ACTION = "SEND" as const;

export async function ensureLinkOutreachSendApprovalPolicy(): Promise<void> {
	const existing = await db
		.select({ id: approvalPolicies.id })
		.from(approvalPolicies)
		.where(
			eq(approvalPolicies.name, LINK_OUTREACH_SEND_APPROVAL_POLICY_NAME),
		)
		.get();

	if (existing) {
		return;
	}

	await db.insert(approvalPolicies).values({
		name: LINK_OUTREACH_SEND_APPROVAL_POLICY_NAME,
		description: "Approval required before sending outreach drafts",
		resourceType: LINK_OUTREACH_RESOURCE_TYPE,
		action: LINK_OUTREACH_SEND_ACTION,
		requiredRoles: JSON.stringify([
			"AGENCY_OWNER",
			"ACCOUNT_MANAGER",
			"STRATEGIST",
		]),
		isActive: true,
	});
}
