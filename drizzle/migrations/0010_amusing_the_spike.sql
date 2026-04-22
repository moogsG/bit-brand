CREATE TABLE `content_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`content_type` text DEFAULT 'UNKNOWN' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`canonical_url` text,
	`published_at` integer,
	`last_crawled_at` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_assets_client_url_unique` ON `content_assets` (`client_id`,`url`);--> statement-breakpoint
CREATE INDEX `content_assets_client_idx` ON `content_assets` (`client_id`);--> statement-breakpoint
CREATE INDEX `content_assets_client_status_idx` ON `content_assets` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_assets_client_type_idx` ON `content_assets` (`client_id`,`content_type`);