CREATE TABLE `eeat_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`questionnaire_id` text NOT NULL,
	`brief_id` text,
	`respondent_user_id` text,
	`responses` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`questionnaire_id`) REFERENCES `eeat_questionnaires`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brief_id`) REFERENCES `content_briefs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`respondent_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `eeat_responses_client_questionnaire_idx` ON `eeat_responses` (`client_id`,`questionnaire_id`);--> statement-breakpoint
CREATE INDEX `eeat_responses_client_brief_idx` ON `eeat_responses` (`client_id`,`brief_id`);--> statement-breakpoint
CREATE INDEX `eeat_responses_client_updated_idx` ON `eeat_responses` (`client_id`,`updated_at`);
