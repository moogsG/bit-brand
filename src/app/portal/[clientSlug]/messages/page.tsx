import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients, clientMessages, clientUsers, users } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { MessagesThread } from "@/components/portal/messages-thread";

export default async function PortalMessagesPage({
	params,
}: {
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/login");
	const { clientSlug } = await params;

	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.slug, clientSlug))
		.get();

	if (!client) redirect("/portal");

	// Guard for client role
	if (session.user.role === "CLIENT") {
		const membership = await db
			.select({ id: clientUsers.id })
			.from(clientUsers)
			.where(
				and(
					eq(clientUsers.clientId, client.id),
					eq(clientUsers.userId, session.user.id),
				),
			)
			.get();
		if (!membership) redirect("/portal");
	}

	const messages = await db
		.select()
		.from(clientMessages)
		.where(eq(clientMessages.clientId, client.id))
		.orderBy(desc(clientMessages.createdAt))
		.limit(200)
		.all();

	const teamMembers = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
		})
		.from(clientUsers)
		.innerJoin(users, eq(clientUsers.userId, users.id))
		.where(eq(clientUsers.clientId, client.id))
		.all();

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Messages</h1>
			<MessagesThread
				messages={messages}
				clientId={client.id}
				currentRole={session.user.role === "ADMIN" ? "ADMIN" : "CLIENT"}
				recipientOptions={teamMembers}
			/>
		</div>
	);
}
