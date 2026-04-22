CREATE TABLE `content_audit_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`recommendation_type` text NOT NULL,
	`severity` text DEFAULT 'INFO' NOT NULL,
	`reason` text NOT NULL,
	`proposed_changes` text DEFAULT '{}' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `content_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_audit_findings_client_created_idx` ON `content_audit_findings` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `content_audit_findings_asset_idx` ON `content_audit_findings` (`asset_id`);--> statement-breakpoint
CREATE INDEX `content_audit_findings_client_type_idx` ON `content_audit_findings` (`client_id`,`recommendation_type`);