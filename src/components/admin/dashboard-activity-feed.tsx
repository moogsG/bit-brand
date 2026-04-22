import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DashboardActivityItem {
	id: string;
	type: "APPROVAL" | "TASK" | "MESSAGE";
	clientId: string;
	clientName: string;
	title: string;
	detail: string;
	createdAt: Date;
}

interface DashboardActivityFeedProps {
	items: DashboardActivityItem[];
}

const typeLabel: Record<DashboardActivityItem["type"], string> = {
	APPROVAL: "Approval",
	TASK: "Task",
	MESSAGE: "Message",
};

export function DashboardActivityFeed({ items }: DashboardActivityFeedProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Clock3 className="h-4 w-4" />
					Recent Activity
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{items.length === 0 ? (
					<p className="text-sm text-muted-foreground">No recent activity in your current scope.</p>
				) : (
					items.map((item) => (
						<div key={item.id} className="rounded-md border p-3">
							<div className="mb-1 flex items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="text-[11px]">
										{typeLabel[item.type]}
									</Badge>
									<p className="text-sm font-medium">{item.title}</p>
								</div>
								<p className="text-xs text-muted-foreground">
									{item.createdAt.toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
									})}
								</p>
							</div>
							<p className="text-xs text-muted-foreground">{item.detail}</p>
							<Link
								href={`/admin/clients/${item.clientId}`}
								className="mt-2 inline-block text-xs font-medium text-foreground underline-offset-2 hover:underline"
							>
								Open {item.clientName}
							</Link>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}
