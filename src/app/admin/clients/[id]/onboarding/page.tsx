import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { OnboardingWizard } from "@/components/admin/onboarding/onboarding-wizard";
import { NorthStarRibbon } from "@/components/shared/north-star-ribbon";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase1Flags } from "@/lib/flags";

export default async function AdminClientOnboardingPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	if (!phase1Flags.onboardingV2()) {
		notFound();
	}

	const session = await auth();
	if (!session || !can("admin", "view", { session })) {
		redirect("/login");
	}

	const { id } = await params;
	const accessContext = await getClientAccessContext(session, id);

	if (!can("onboarding", "view", { session, clientId: id, ...accessContext })) {
		redirect("/admin/clients");
	}

	const client = await db
		.select({ id: clients.id, name: clients.name, isActive: clients.isActive })
		.from(clients)
		.where(and(eq(clients.id, id), eq(clients.isActive, true)))
		.get();

	if (!client) {
		notFound();
	}

	const canEdit = can("onboarding", "edit", {
		session,
		clientId: id,
		...accessContext,
	});

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<AdminHeader title={`${client.name} - Onboarding`} />
			<main className="flex-1 space-y-6 overflow-y-auto p-6">
				<div className="space-y-3">
					<Link
						href={`/admin/clients/${id}`}
						className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						<ArrowLeft className="h-3.5 w-3.5" />
						Back to {client.name}
					</Link>
					<div>
						<h1 className="text-xl font-bold">Onboarding Wizard</h1>
						<p className="text-sm text-muted-foreground">
							Capture client fundamentals, North Star, and baseline context.
						</p>
					</div>
				</div>

				<NorthStarRibbon clientId={id} onboardingHref={`/admin/clients/${id}/onboarding`} />

				<OnboardingWizard clientId={id} clientName={client.name} canEdit={canEdit} />
			</main>
		</div>
	);
}
