CREATE TABLE `approval_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`resource_type` text NOT NULL,
	`action` text NOT NULL,
	`required_roles` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approval_policies_name_unique` ON `approval_policies` (`name`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`client_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`rejected_by` text,
	`rejected_at` integer,
	`rejection_reason` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `approval_policies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rejected_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `approvals_status_idx` ON `approvals` (`status`);--> statement-breakpoint
CREATE INDEX `approvals_resource_idx` ON `approvals` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `approvals_client_idx` ON `approvals` (`client_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`client_id` text,
	`changes` text DEFAULT '{}',
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_client_idx` ON `audit_logs` (`client_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `kanban_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`color` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kanban_columns_client_position_idx` ON `kanban_columns` (`client_id`,`position`);--> statement-breakpoint
CREATE TABLE `revision_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`approval_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`reason` text NOT NULL,
	`suggestions` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`addressed_by` text,
	`addressed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`approval_id`) REFERENCES `approvals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`addressed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`client_id` text,
	`assigned_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_role_scope` ON `role_assignments` (`user_id`,`role_id`,`client_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`permissions` text DEFAULT '[]' NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'TODO' NOT NULL,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`assigned_to` text,
	`created_by` text NOT NULL,
	`due_date` integer,
	`completed_at` integer,
	`kanban_column_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]',
	`linked_resource_type` text,
	`linked_resource_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kanban_column_id`) REFERENCES `kanban_columns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_client_idx` ON `tasks` (`client_id`);--> statement-breakpoint
CREATE INDEX `tasks_assigned_idx` ON `tasks` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_column_position_idx` ON `tasks` (`kanban_column_id`,`position`);