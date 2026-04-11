CREATE TABLE `ahrefs_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`domain_rating` real,
	`url_rating` real,
	`backlinks` integer DEFAULT 0,
	`referring_domains` integer DEFAULT 0,
	`organic_keywords` integer DEFAULT 0,
	`organic_traffic` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ahrefs_client_date_idx` ON `ahrefs_metrics` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `ai_visibility` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`overall_score` real,
	`rankscale_score` real,
	`semrush_score` real,
	`total_prompts_tested` integer DEFAULT 0,
	`prompts_visible` integer DEFAULT 0,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_visibility_client_date_idx` ON `ai_visibility` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `client_users` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_client_user` ON `client_users` (`client_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`industry` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_slug_unique` ON `clients` (`slug`);--> statement-breakpoint
CREATE TABLE `data_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`type` text NOT NULL,
	`credentials_enc` text,
	`property_id` text,
	`site_url` text,
	`access_token` text,
	`refresh_token` text,
	`token_expires_at` integer,
	`is_connected` integer DEFAULT false NOT NULL,
	`last_synced_at` integer,
	`last_sync_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_client_source` ON `data_sources` (`client_id`,`type`);--> statement-breakpoint
CREATE TABLE `ga4_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`users` integer DEFAULT 0 NOT NULL,
	`new_users` integer DEFAULT 0 NOT NULL,
	`pageviews` integer DEFAULT 0 NOT NULL,
	`bounce_rate` real,
	`avg_session_duration` real,
	`organic_sessions` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ga4_client_date_idx` ON `ga4_metrics` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `gsc_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`query` text NOT NULL,
	`page` text,
	`clicks` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`ctr` real,
	`position` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gsc_client_date_query_idx` ON `gsc_metrics` (`client_id`,`date`,`query`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`client_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitations_token_idx` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitations_email_idx` ON `invitations` (`email`);--> statement-breakpoint
CREATE TABLE `keyword_research` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`keyword` text NOT NULL,
	`monthly_volume` integer,
	`difficulty` integer,
	`intent` text,
	`priority` text DEFAULT 'MEDIUM',
	`current_position` integer,
	`target_position` integer,
	`target_url` text,
	`notes` text,
	`tags` text,
	`status` text DEFAULT 'OPPORTUNITY',
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `keyword_client_idx` ON `keyword_research` (`client_id`);--> statement-breakpoint
CREATE TABLE `monthly_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`title` text NOT NULL,
	`sections` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'DRAFT',
	`published_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_client_month_year` ON `monthly_reports` (`client_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `rankscale_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`prompt` text NOT NULL,
	`platform` text NOT NULL,
	`is_visible` integer DEFAULT false NOT NULL,
	`position` integer,
	`response_snippet` text,
	`visibility_score` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rankscale_client_date_idx` ON `rankscale_metrics` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `semrush_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`ai_visibility_score` real,
	`brand_mentions` integer DEFAULT 0,
	`platform` text,
	`competitor_comparison` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `semrush_client_date_idx` ON `semrush_metrics` (`client_id`,`date`);--> statement-breakpoint
CREATE TABLE `seo_strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`sections` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'DRAFT',
	`published_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'CLIENT' NOT NULL,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);