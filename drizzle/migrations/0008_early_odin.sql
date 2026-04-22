CREATE TABLE `ai_prompt_citations` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`run_id` text NOT NULL,
	`run_result_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`engine` text NOT NULL,
	`domain` text NOT NULL,
	`url` text,
	`title` text,
	`content_type` text DEFAULT 'UNKNOWN' NOT NULL,
	`freshness_hint` text DEFAULT 'UNKNOWN' NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `ai_visibility_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_result_id`) REFERENCES `ai_visibility_run_results`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_id`) REFERENCES `ai_visibility_prompts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_prompt_citations_client_date_idx` ON `ai_prompt_citations` (`client_id`,`date`);--> statement-breakpoint
CREATE INDEX `ai_prompt_citations_client_domain_idx` ON `ai_prompt_citations` (`client_id`,`domain`);--> statement-breakpoint
CREATE INDEX `ai_prompt_citations_client_engine_idx` ON `ai_prompt_citations` (`client_id`,`engine`);--> statement-breakpoint
CREATE INDEX `ai_prompt_citations_run_idx` ON `ai_prompt_citations` (`run_id`);--> statement-breakpoint
CREATE INDEX `ai_prompt_citations_run_result_idx` ON `ai_prompt_citations` (`run_result_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_prompt_citations_unique` ON `ai_prompt_citations` (`run_result_id`,`domain`,`url`);--> statement-breakpoint
CREATE TABLE `ai_visibility_prompt_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_visibility_prompt_sets_client_idx` ON `ai_visibility_prompt_sets` (`client_id`);--> statement-breakpoint
CREATE INDEX `ai_visibility_prompt_sets_client_active_idx` ON `ai_visibility_prompt_sets` (`client_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `ai_visibility_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_set_id` text NOT NULL,
	`text` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`prompt_set_id`) REFERENCES `ai_visibility_prompt_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_visibility_prompts_set_order_idx` ON `ai_visibility_prompts` (`prompt_set_id`,`order`);--> statement-breakpoint
CREATE INDEX `ai_visibility_prompts_set_active_idx` ON `ai_visibility_prompts` (`prompt_set_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `ai_visibility_run_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`client_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`engine` text NOT NULL,
	`prompt_text` text NOT NULL,
	`is_visible` integer DEFAULT false NOT NULL,
	`position` integer,
	`citation_domain` text,
	`citation_snippet` text,
	`response_snippet` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `ai_visibility_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_id`) REFERENCES `ai_visibility_prompts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_visibility_run_results_run_idx` ON `ai_visibility_run_results` (`run_id`);--> statement-breakpoint
CREATE INDEX `ai_visibility_run_results_client_idx` ON `ai_visibility_run_results` (`client_id`);--> statement-breakpoint
CREATE INDEX `ai_visibility_run_results_engine_idx` ON `ai_visibility_run_results` (`engine`);--> statement-breakpoint
CREATE INDEX `ai_visibility_run_results_prompt_idx` ON `ai_visibility_run_results` (`prompt_id`);--> statement-breakpoint
CREATE INDEX `ai_visibility_run_results_run_engine_idx` ON `ai_visibility_run_results` (`run_id`,`engine`);--> statement-breakpoint
CREATE TABLE `ai_visibility_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`prompt_set_id` text NOT NULL,
	`engines` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`triggered_by` text NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_set_id`) REFERENCES `ai_visibility_prompt_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_visibility_runs_client_idx` ON `ai_visibility_runs` (`client_id`);--> statement-breakpoint
CREATE INDEX `ai_visibility_runs_prompt_set_idx` ON `ai_visibility_runs` (`prompt_set_id`);--> statement-breakpoint
CREATE INDEX `ai_visibility_runs_status_idx` ON `ai_visibility_runs` (`status`);--> statement-breakpoint
CREATE INDEX `ai_visibility_runs_client_created_idx` ON `ai_visibility_runs` (`client_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `ai_visibility` ADD `engine_breakdown` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_visibility` ADD `last_run_id` text;