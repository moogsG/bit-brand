CREATE TABLE `user_client_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_client_assignment` ON `user_client_assignments` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `user_client_assignments_user_idx` ON `user_client_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_client_assignments_client_idx` ON `user_client_assignments` (`client_id`);