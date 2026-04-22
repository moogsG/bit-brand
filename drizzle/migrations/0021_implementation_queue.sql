CREATE TABLE `implementation_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`proposal_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`provider` text DEFAULT 'noop' NOT NULL,
	`requested_by` text NOT NULL,
	`approval_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `implementation_proposals_client_idx` ON `implementation_proposals` (`client_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `implementation_proposals_status_idx` ON `implementation_proposals` (`status`);--> statement-breakpoint
CREATE INDEX `implementation_proposals_approval_idx` ON `implementation_proposals` (`approval_id`);--> statement-breakpoint

CREATE TABLE `implementation_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`client_id` text NOT NULL,
	`provider` text DEFAULT 'noop' NOT NULL,
	`status` text DEFAULT 'RUNNING' NOT NULL,
	`started_by` text NOT NULL,
	`output` text DEFAULT '{}' NOT NULL,
	`error` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`proposal_id`) REFERENCES `implementation_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `implementation_executions_proposal_idx` ON `implementation_executions` (`proposal_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `implementation_executions_client_idx` ON `implementation_executions` (`client_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `implementation_executions_status_idx` ON `implementation_executions` (`status`);--> statement-breakpoint

CREATE TABLE `implementation_rollbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`client_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`reason` text,
	`status` text DEFAULT 'RUNNING' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`execution_id`) REFERENCES `implementation_executions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposal_id`) REFERENCES `implementation_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `implementation_rollbacks_execution_idx` ON `implementation_rollbacks` (`execution_id`);--> statement-breakpoint
CREATE INDEX `implementation_rollbacks_proposal_idx` ON `implementation_rollbacks` (`proposal_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `implementation_rollbacks_client_idx` ON `implementation_rollbacks` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `implementation_rollbacks_status_idx` ON `implementation_rollbacks` (`status`);--> statement-breakpoint

INSERT OR IGNORE INTO `approval_policies` (
	`id`,
	`name`,
	`description`,
	`resource_type`,
	`action`,
	`required_roles`,
	`is_active`,
	`created_at`,
	`updated_at`
) VALUES (
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
	'implementation_proposal_execute',
	'Approval required before executing implementation queue proposals',
	'IMPLEMENTATION_PROPOSAL',
	'EXECUTE',
	'["AGENCY_OWNER","ACCOUNT_MANAGER","STRATEGIST"]',
	1,
	unixepoch(),
	unixepoch()
);
