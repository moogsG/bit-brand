ALTER TABLE `tasks` ADD `linked_resource_label` text;--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`task_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `notifications` (`recipient_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_client_created_idx` ON `notifications` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_task_type_created_idx` ON `notifications` (`task_id`,`type`,`created_at`);
