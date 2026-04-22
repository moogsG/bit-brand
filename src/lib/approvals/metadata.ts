interface ApprovalMetadataRecord {
	[key: string]: unknown;
}

export function parseApprovalMetadata(metadata: string | null | undefined) {
	if (!metadata) {
		return {} as ApprovalMetadataRecord;
	}

	try {
		const parsed = JSON.parse(metadata) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as ApprovalMetadataRecord;
		}
		return {} as ApprovalMetadataRecord;
	} catch {
		return {} as ApprovalMetadataRecord;
	}
}

export function getApprovalDisplayContext(params: {
	resourceType: string;
	resourceId: string;
	metadata: string | null | undefined;
	clientName?: string | null;
}) {
	const metadata = parseApprovalMetadata(params.metadata);
	const proposalCount =
		typeof metadata.proposalCount === "number" ? metadata.proposalCount : null;
	const proposalTitle =
		typeof metadata.proposalTitle === "string" ? metadata.proposalTitle : null;
	const fallbackTitle =
		typeof metadata.title === "string" ? metadata.title : null;
	const targetRef =
		typeof metadata.targetRef === "string" ? metadata.targetRef : null;

	if (params.resourceType === "IMPLEMENTATION_PROPOSAL") {
		const title =
			proposalCount && proposalCount > 1
				? `${proposalCount} implementation proposals`
				: (proposalTitle ?? fallbackTitle ?? "Implementation proposal");

		const subtitleParts = [
			targetRef ? `Target: ${targetRef}` : null,
			params.clientName ? `Client: ${params.clientName}` : null,
		].filter((value): value is string => Boolean(value));

		return {
			metadata,
			resourceLabel: "Implementation Proposal",
			title,
			subtitle: subtitleParts.join(" • ") || null,
		};
	}

	return {
		metadata,
		resourceLabel: params.resourceType,
		title: fallbackTitle ?? params.resourceId,
		subtitle: params.clientName ? `Client: ${params.clientName}` : null,
	};
}
