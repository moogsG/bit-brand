CREATE TABLE `backlink_inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_domain` text NOT NULL,
	`target_url` text NOT NULL,
	`anchor_text` text,
	`first_seen_at` integer,
	`last_seen_at` integer,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`metrics` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `backlink_inventory_client_status_idx` ON `backlink_inventory` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `backlink_inventory_client_source_domain_idx` ON `backlink_inventory` (`client_id`,`source_domain`);--> statement-breakpoint
CREATE INDEX `backlink_inventory_client_last_seen_idx` ON `backlink_inventory` (`client_id`,`last_seen_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `backlink_inventory_client_source_target_unique` ON `backlink_inventory` (`client_id`,`source_url`,`target_url`);
