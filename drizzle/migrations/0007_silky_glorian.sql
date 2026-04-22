CREATE TABLE `client_onboarding_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`completed_at` integer,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_client_version_unique` ON `client_onboarding_profiles` (`client_id`,`version`);--> statement-breakpoint
CREATE INDEX `onboarding_client_updated_idx` ON `client_onboarding_profiles` (`client_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `onboarding_business_fundamentals` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`business_name` text NOT NULL,
	`domain` text NOT NULL,
	`industry` text,
	`target_geo` text,
	`primary_offer` text,
	`ideal_customer` text,
	`pricing_model` text,
	`sales_cycle_days` integer,
	`notes` text,
	FOREIGN KEY (`profile_id`) REFERENCES `client_onboarding_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_business_profile_unique` ON `onboarding_business_fundamentals` (`profile_id`);--> statement-breakpoint
CREATE TABLE `onboarding_competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`positioning` text,
	`strengths` text,
	`weaknesses` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `client_onboarding_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `onboarding_competitors_profile_idx` ON `onboarding_competitors` (`profile_id`,`position`);--> statement-breakpoint
CREATE TABLE `onboarding_conversion_architecture` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`primary_conversion` text NOT NULL,
	`secondary_conversions` text DEFAULT '[]' NOT NULL,
	`lead_capture_points` text DEFAULT '[]' NOT NULL,
	`crm_platform` text,
	`analytics_stack` text,
	`attribution_model` text,
	FOREIGN KEY (`profile_id`) REFERENCES `client_onboarding_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_conversion_profile_unique` ON `onboarding_conversion_architecture` (`profile_id`);--> statement-breakpoint
CREATE TABLE `onboarding_current_state_baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`monthly_organic_sessions` integer,
	`monthly_leads` integer,
	`lead_to_customer_rate` real,
	`close_rate` real,
	`average_order_value` real,
	`customer_lifetime_value` real,
	`notes` text,
	FOREIGN KEY (`profile_id`) REFERENCES `client_onboarding_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_baseline_profile_unique` ON `onboarding_current_state_baselines` (`profile_id`);--> statement-breakpoint
CREATE TABLE `onboarding_north_star_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`statement` text NOT NULL,
	`metric_name` text,
	`current_value` real,
	`target_value` real,
	`target_date` text,
	`time_horizon_months` integer,
	`confidence_notes` text,
	FOREIGN KEY (`profile_id`) REFERENCES `client_onboarding_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_north_star_profile_unique` ON `onboarding_north_star_goals` (`profile_id`);--> statement-breakpoint
CREATE TABLE `onboarding_strategic_levers` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`lever` text NOT NULL,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`owner_role` text,
	`notes` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `client_onboarding_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `onboarding_levers_profile_idx` ON `onboarding_strategic_levers` (`profile_id`,`position`);