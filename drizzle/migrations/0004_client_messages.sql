CREATE TABLE `client_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `client_id` text NOT NULL,
  `sender_id` text NOT NULL,
  `sender_role` text DEFAULT 'CLIENT' NOT NULL,
  `body` text NOT NULL,
  `read_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `client_messages_client_idx` ON `client_messages` (`client_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `client_messages_sender_idx` ON `client_messages` (`sender_id`);
