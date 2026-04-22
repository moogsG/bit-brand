ALTER TABLE `technical_issues` ADD COLUMN `priority_score` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `technical_issues` ADD COLUMN `priority_band` text DEFAULT 'LOW' NOT NULL;
--> statement-breakpoint
ALTER TABLE `technical_issues` ADD COLUMN `proposable` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `technical_issues` ADD COLUMN `proposable_rationale` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX `technical_issues_client_priority_idx` ON `technical_issues` (`client_id`,`priority_band`,`priority_score`);
--> statement-breakpoint
ALTER TABLE `implementation_proposals` ADD COLUMN `source_technical_issue_id` text;
--> statement-breakpoint
ALTER TABLE `implementation_proposals` ADD COLUMN `source_technical_audit_run_id` text;
--> statement-breakpoint
CREATE INDEX `implementation_proposals_source_issue_idx` ON `implementation_proposals` (`client_id`,`source_technical_issue_id`);
--> statement-breakpoint
CREATE INDEX `implementation_proposals_source_run_idx` ON `implementation_proposals` (`client_id`,`source_technical_audit_run_id`);
