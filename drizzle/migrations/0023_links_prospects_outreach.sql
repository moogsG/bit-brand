CREATE TABLE `link_prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`domain` text NOT NULL,
	`url` text,
	`contact_name` text,
	`contact_email` text,
	`notes` text,
	`lifecycle_state` text DEFAULT 'DISCOVERED' NOT NULL,
	`relevance_score` integer DEFAULT 0 NOT NULL,
	`authority_score` integer DEFAULT 0 NOT NULL,
	`traffic_score` integer DEFAULT 0 NOT NULL,
	`relationship_score` integer DEFAULT 0 NOT NULL,
	`deterministic_score` integer DEFAULT 0 NOT NULL,
	`score_breakdown` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `link_prospects_client_state_idx` ON `link_prospects` (`client_id`,`lifecycle_state`);--> statement-breakpoint
CREATE INDEX `link_prospects_client_score_idx` ON `link_prospects` (`client_id`,`deterministic_score`);--> statement-breakpoint
CREATE INDEX `link_prospects_client_domain_idx` ON `link_prospects` (`client_id`,`domain`);--> statement-breakpoint

CREATE TABLE `link_outreach_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`prospect_id` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`approval_id` text,
	`requested_approval_at` integer,
	`approved_at` integer,
	`sent_at` integer,
	`sent_by` text,
	`send_metadata` text DEFAULT '{}' NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prospect_id`) REFERENCES `link_prospects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sent_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `link_outreach_drafts_client_status_idx` ON `link_outreach_drafts` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `link_outreach_drafts_client_prospect_idx` ON `link_outreach_drafts` (`client_id`,`prospect_id`);--> statement-breakpoint
CREATE INDEX `link_outreach_drafts_client_sent_idx` ON `link_outreach_drafts` (`client_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `link_outreach_drafts_approval_idx` ON `link_outreach_drafts` (`approval_id`);--> statement-breakpoint

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
	'link_outreach_send',
	'Approval required before sending outreach drafts',
	'LINK_OUTREACH_DRAFT',
	'SEND',
	'["AGENCY_OWNER","ACCOUNT_MANAGER","STRATEGIST"]',
	1,
	unixepoch(),
	unixepoch()
);
