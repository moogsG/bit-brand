CREATE TABLE `implementation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`execution_id` text,
	`rollback_id` text,
	`client_id` text NOT NULL,
	`type` text DEFAULT 'PRE_EXECUTION' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `implementation_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`execution_id`) REFERENCES `implementation_executions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`rollback_id`) REFERENCES `implementation_rollbacks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `implementation_snapshots_proposal_idx` ON `implementation_snapshots` (`proposal_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `implementation_snapshots_execution_idx` ON `implementation_snapshots` (`execution_id`);--> statement-breakpoint
CREATE INDEX `implementation_snapshots_rollback_idx` ON `implementation_snapshots` (`rollback_id`);--> statement-breakpoint
CREATE INDEX `implementation_snapshots_client_idx` ON `implementation_snapshots` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `implementation_snapshots_type_idx` ON `implementation_snapshots` (`type`);
