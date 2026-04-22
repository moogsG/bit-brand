CREATE TABLE `content_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`asset_id` text,
	`title` text NOT NULL,
	`primary_keyword` text NOT NULL,
	`supporting_keywords` text DEFAULT '[]' NOT NULL,
	`outline` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`client_visible_summary` text,
	`internal_notes` text,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `content_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_briefs_client_updated_idx` ON `content_briefs` (`client_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `content_briefs_client_status_idx` ON `content_briefs` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_briefs_asset_idx` ON `content_briefs` (`asset_id`);