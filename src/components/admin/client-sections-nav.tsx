import Link from "next/link";

type ClientSectionKey =
	| "dashboard"
	| "onboarding"
	| "opportunities"
	| "tasks"
	| "communications"
	| "users"
	| "aiVisibility"
	| "keywords"
	| "strategy"
	| "reports"
	| "technical"
	| "links"
	| "implementation";

interface ClientSectionsNavProps {
	clientId: string;
	active: ClientSectionKey;
}

const sections: Array<{ key: ClientSectionKey; label: string; href: (clientId: string) => string }> = [
	{ key: "dashboard", label: "Dashboard", href: (clientId) => `/admin/clients/${clientId}?tab=dashboard` },
	{
		key: "aiVisibility",
		label: "AI Visibility",
		href: (clientId) => `/admin/clients/${clientId}?tab=ai-visibility`,
	},
	{
		key: "onboarding",
		label: "Onboarding",
		href: (clientId) => `/admin/clients/${clientId}/onboarding`,
	},
	{
		key: "opportunities",
		label: "Opportunities",
		href: (clientId) => `/admin/clients/${clientId}/opportunities`,
	},
	{ key: "tasks", label: "Tasks", href: (clientId) => `/admin/clients/${clientId}?tab=tasks` },
	{
		key: "communications",
		label: "Communications",
		href: (clientId) => `/admin/clients/${clientId}?tab=communications`,
	},
	{ key: "users", label: "Users", href: (clientId) => `/admin/clients/${clientId}?tab=users` },
	{ key: "keywords", label: "Keywords", href: (clientId) => `/admin/clients/${clientId}/keywords` },
	{ key: "strategy", label: "Strategy", href: (clientId) => `/admin/clients/${clientId}/strategy` },
	{ key: "reports", label: "Reports", href: (clientId) => `/admin/clients/${clientId}/reports` },
	{
		key: "technical",
		label: "Technical",
		href: (clientId) => `/admin/clients/${clientId}/technical-audits`,
	},
	{ key: "links", label: "Links", href: (clientId) => `/admin/clients/${clientId}/links` },
	{
		key: "implementation",
		label: "Implementation",
		href: (clientId) => `/admin/clients/${clientId}/implementation-queue`,
	},
];

export function ClientSectionsNav({ clientId, active }: ClientSectionsNavProps) {
	return (
		<div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
			<nav className="flex gap-1 overflow-x-auto py-2">
				{sections.map((section) => (
					<Link
						key={section.key}
						href={section.href(clientId)}
						className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
							active === section.key
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						{section.label}
					</Link>
				))}
			</nav>
		</div>
	);
}
