CREATE TABLE `content_calendar_items` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`brief_id` text,
	`title` text NOT NULL,
	`owner_user_id` text,
	`due_date` text,
	`publish_date` text,
	`workflow_status` text DEFAULT 'BACKLOG' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brief_id`) REFERENCES `content_briefs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `content_calendar_items_client_due_date_idx` ON `content_calendar_items` (`client_id`,`due_date`);--> statement-breakpoint
CREATE INDEX `content_calendar_items_client_publish_date_idx` ON `content_calendar_items` (`client_id`,`publish_date`);--> statement-breakpoint
CREATE INDEX `content_calendar_items_client_status_idx` ON `content_calendar_items` (`client_id`,`workflow_status`);--> statement-breakpoint
CREATE INDEX `content_calendar_items_client_updated_idx` ON `content_calendar_items` (`client_id`,`updated_at`);
