CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	`diff_summary` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`brief_id`) REFERENCES `content_briefs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_brief_version_unique` ON `content_versions` (`brief_id`,`version`);--> statement-breakpoint
CREATE INDEX `content_versions_brief_created_idx` ON `content_versions` (`brief_id`,`created_at`);
