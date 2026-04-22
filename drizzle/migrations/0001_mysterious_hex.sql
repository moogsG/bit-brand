CREATE TABLE `api_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`credentials_enc` text NOT NULL,
	`label` text,
	`is_active` integer DEFAULT true NOT NULL,
	`last_tested_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_provider` ON `api_credentials` (`provider`);--> statement-breakpoint
CREATE TABLE `moz_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`domain_authority` integer,
	`page_authority` integer,
	`spam_score` integer,
	`brand_authority` integer,
	`backlinks` integer DEFAULT 0,
	`referring_domains` integer DEFAULT 0,
	`organic_keywords` integer DEFAULT 0,
	`organic_traffic` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moz_client_date_idx` ON `moz_metrics` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`rows_inserted` integer,
	`error` text,
	`triggered_by` text DEFAULT 'MANUAL' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_jobs_client_source_idx` ON `sync_jobs` (`client_id`,`source`,`created_at`);--> statement-breakpoint
ALTER TABLE `ai_visibility` ADD `secondary_score` integer;--> statement-breakpoint
ALTER TABLE `data_sources` ADD `property_identifier` text;--> statement-breakpoint
ALTER TABLE `keyword_research` ADD `last_enriched_at` integer;