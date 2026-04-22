import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ImplementationChangesTable } from "@/components/portal/implementation-changes-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { listClientSafeImplementationChanges } from "@/lib/implementation-agent";

export default async function PortalImplementationPage({
	params,
}: {
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) redirect("/login");

	const { clientSlug } = await params;
	const client = await db
		.select({ id: clients.id, name: clients.name })
		.from(clients)
		.where(eq(clients.slug, clientSlug))
		.get();

	if (!client) redirect("/portal");

	const accessContext = await getClientAccessContext(session, client.id);
	if (
		!can("technical", "view", {
			session,
			clientId: client.id,
			...accessContext,
		})
	) {
		redirect(`/portal/${clientSlug}/dashboard`);
	}

	const changes = await listClientSafeImplementationChanges(client.id);

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Implementation Changes</h1>
			<Card>
				<CardHeader>
					<CardTitle>
						Approved and executed implementation changes for {client.name}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ImplementationChangesTable changes={changes} clientId={client.id} />
				</CardContent>
			</Card>
		</div>
	);
}
