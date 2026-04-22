CREATE TABLE `eeat_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`questionnaire_id` text NOT NULL,
	`response_id` text NOT NULL,
	`brief_id` text,
	`overall_score` real NOT NULL,
	`factor_breakdown` text NOT NULL,
	`recommendations` text NOT NULL,
	`score_version` text DEFAULT 'eeat-score-v1' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`questionnaire_id`) REFERENCES `eeat_questionnaires`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`response_id`) REFERENCES `eeat_responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brief_id`) REFERENCES `content_briefs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eeat_scores_response_unique` ON `eeat_scores` (`response_id`);--> statement-breakpoint
CREATE INDEX `eeat_scores_client_created_idx` ON `eeat_scores` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `eeat_scores_client_questionnaire_created_idx` ON `eeat_scores` (`client_id`,`questionnaire_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `eeat_scores_client_brief_created_idx` ON `eeat_scores` (`client_id`,`brief_id`,`created_at`);
