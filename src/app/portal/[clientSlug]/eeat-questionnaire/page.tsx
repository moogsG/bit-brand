import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PortalEeatQuestionnaireForm } from "@/components/portal/portal-eeat-questionnaire-form";
import { auth } from "@/lib/auth";
import { can } from "@/lib/auth/authorize";
import { getClientAccessContext } from "@/lib/auth/client-access";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { phase3Flags } from "@/lib/flags";

export default async function PortalEeatQuestionnairePage({
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
		.select({ id: clients.id, name: clients.name })
		.from(clients)
		.where(eq(clients.slug, clientSlug))
		.get();

	if (!client) redirect("/portal");

	const accessContext = await getClientAccessContext(session, client.id);
	if (!can("content", "view", { session, clientId: client.id, ...accessContext })) {
		redirect("/portal");
	}

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">EEAT Questionnaire</h1>
			<PortalEeatQuestionnaireForm clientId={client.id} />
		</div>
	);
}
