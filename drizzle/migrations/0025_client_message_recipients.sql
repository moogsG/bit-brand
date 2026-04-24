ALTER TABLE `client_messages` ADD `recipient_scope` text DEFAULT 'TEAM' NOT NULL;
--> statement-breakpoint
ALTER TABLE `client_messages` ADD `recipient_user_ids` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE INDEX `client_messages_recipient_scope_idx` ON `client_messages` (`client_id`,`recipient_scope`);
