import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { ImplementationQueuePanel } from "@/components/admin/implementation-queue-panel";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

export default async function AdminImplementationQueuePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	if (!phase3Flags.technicalAgentV1()) {
		notFound();
	}

	const { id } = await params;
	const accessContext = await getClientAccessContext(session, id);

	if (!can("technical", "view", { session, clientId: id, ...accessContext })) {
		redirect("/portal");
	}

	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.id, id))
		.get();

	if (!client) {
		notFound();
	}

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<AdminHeader title={`${client.name} — Implementation Queue`} />
			<main className="flex-1 space-y-6 overflow-y-auto p-6">
				<div className="space-y-3">
					<Link
						href={`/admin/clients/${id}?tab=overview`}
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to {client.name}
					</Link>
					<div>
						<h1 className="text-xl font-bold">Implementation Queue</h1>
						<p className="text-sm text-muted-foreground">
							Create proposal slices, request approval, execute, and rollback.
						</p>
					</div>
				</div>

				<ImplementationQueuePanel clientId={id} />
			</main>
		</div>
	);
}
