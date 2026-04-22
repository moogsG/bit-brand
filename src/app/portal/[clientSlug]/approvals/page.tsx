import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PortalApprovalsList } from "@/components/portal/portal-approvals-list";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { approvals, clients } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

export default async function PortalApprovalsPage({
	params,
}: {
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/login");
	const { clientSlug } = await params;
	if (!phase3Flags.portalV2()) {
		redirect(`/portal/${clientSlug}/dashboard`);
	}

	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.slug, clientSlug))
		.get();

	if (!client) redirect("/portal");

	const accessContext = await getClientAccessContext(session, client.id);
	if (!can("approvals", "view", { session, clientId: client.id, ...accessContext })) {
		redirect("/portal");
	}

	const canApprove = can("approvals", "approve", {
		session,
		clientId: client.id,
		...accessContext,
	});

	const items = await db
		.select()
		.from(approvals)
		.where(eq(approvals.clientId, client.id))
		.orderBy(desc(approvals.createdAt))
		.all();

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Approvals</h1>
			<PortalApprovalsList
				approvals={items}
				currentUserId={session.user.id}
				canApprove={canApprove}
			/>
		</div>
	);
}
