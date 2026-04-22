import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { NotificationsList } from "@/components/portal/notifications-list";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients, notifications } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

export default async function PortalNotificationsPage({
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
	if (!can("notifications", "view", { session, clientId: client.id, ...accessContext })) {
		redirect("/portal");
	}

	const rows = await db
		.select()
		.from(notifications)
		.where(
			and(
				eq(notifications.clientId, client.id),
				eq(notifications.recipientUserId, session.user.id),
			),
		)
		.orderBy(desc(notifications.createdAt))
		.limit(200)
		.all();

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Notifications</h1>
			<NotificationsList clientId={client.id} notifications={rows} />
		</div>
	);
}
