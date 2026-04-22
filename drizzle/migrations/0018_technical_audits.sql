CREATE TABLE `technical_audit_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`status` text DEFAULT 'RUNNING' NOT NULL,
	`seed_urls` text DEFAULT '[]' NOT NULL,
	`triggered_by` text,
	`pages_crawled` integer DEFAULT 0 NOT NULL,
	`issues_found` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `technical_audit_runs_client_started_idx` ON `technical_audit_runs` (`client_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `technical_audit_runs_status_idx` ON `technical_audit_runs` (`status`);--> statement-breakpoint
CREATE TABLE `technical_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`client_id` text NOT NULL,
	`url` text NOT NULL,
	`issue_type` text NOT NULL,
	`severity` text DEFAULT 'WARNING' NOT NULL,
	`message` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `technical_audit_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `technical_issues_run_idx` ON `technical_issues` (`run_id`);--> statement-breakpoint
CREATE INDEX `technical_issues_client_severity_idx` ON `technical_issues` (`client_id`,`severity`);--> statement-breakpoint
CREATE INDEX `technical_issues_client_type_idx` ON `technical_issues` (`client_id`,`issue_type`);
