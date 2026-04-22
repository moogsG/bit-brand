import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { NorthStarRibbon } from "@/components/shared/north-star-ribbon";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

export default async function PortalClientLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ clientSlug: string }>;
}) {
	const session = await auth();
	if (!session) {
		redirect("/login");
	}

	const { clientSlug } = await params;

	// Verify the client slug exists and is active
	const client = await db
		.select()
		.from(clients)
		.where(and(eq(clients.slug, clientSlug), eq(clients.isActive, true)))
		.get();

	if (!client) {
		redirect("/portal");
	}

	const accessContext = await getClientAccessContext(session, client.id);
	const portalV2Enabled = phase3Flags.portalV2();

	if (
		!can("portal", "view", { session, clientId: client.id, ...accessContext })
	) {
		redirect("/portal");
	}

	return (
		<div className="flex flex-col h-screen overflow-hidden bg-background">
			{/* Impersonation banner — full width, sticky top, only visible when ?impersonate=true */}
			<ImpersonationBanner clientName={client.name} clientId={client.id} />

			<div className="flex flex-1 overflow-hidden">
				{/* Fixed sidebar — 256px (w-64) */}
				<PortalSidebar
					clientName={client.name}
					clientDomain={client.domain}
					clientSlug={clientSlug}
					userName={session.user.name ?? "User"}
					userEmail={session.user.email ?? ""}
					userRole={session.user.role}
					userRawRole={session.user.rawRole}
					portalV2Enabled={portalV2Enabled}
				/>

				{/* Main content — offset by sidebar width */}
				<div className="flex flex-1 flex-col overflow-hidden pl-64">
					<PortalHeader
						userName={session.user.name ?? "User"}
						userEmail={session.user.email ?? ""}
					/>
					<main className="flex-1 overflow-y-auto p-6 bg-muted/30">
						<div className="mb-4">
							<NorthStarRibbon clientId={client.id} />
						</div>
						{children}
					</main>
				</div>
			</div>
		</div>
	);
}
