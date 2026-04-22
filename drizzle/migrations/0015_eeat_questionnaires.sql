CREATE TABLE `eeat_questionnaires` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`content_type` text NOT NULL,
	`schema` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `eeat_questionnaires_client_content_type_idx` ON `eeat_questionnaires` (`client_id`,`content_type`);--> statement-breakpoint
CREATE INDEX `eeat_questionnaires_client_active_idx` ON `eeat_questionnaires` (`client_id`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `eeat_questionnaires_client_content_type_version_unique` ON `eeat_questionnaires` (`client_id`,`content_type`,`version`);
