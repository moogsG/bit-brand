CREATE TABLE `ai_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`route_key` text NOT NULL,
	`client_id` text,
	`user_id` text,
	`module` text,
	`lens_key` text,
	`scope` text,
	`http_status` integer NOT NULL,
	`success` integer DEFAULT true NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`input_shape_hash` text NOT NULL,
	`output_shape_hash` text NOT NULL,
	`error_code` text,
	`meta` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_interactions_request_id_unique` ON `ai_interactions` (`request_id`);--> statement-breakpoint
CREATE INDEX `ai_interactions_client_idx` ON `ai_interactions` (`client_id`);--> statement-breakpoint
CREATE INDEX `ai_interactions_route_created_idx` ON `ai_interactions` (`route_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `ai_interactions_user_idx` ON `ai_interactions` (`user_id`);