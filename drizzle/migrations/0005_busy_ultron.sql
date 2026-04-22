INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), 'AGENCY_OWNER', 'Agency owner with full platform access', '["*"]', true, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'AGENCY_OWNER');--> statement-breakpoint
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), 'ACCOUNT_MANAGER', 'Manages assigned client accounts and operations', '["manage_clients","manage_reports","manage_tasks"]', true, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'ACCOUNT_MANAGER');--> statement-breakpoint
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), 'STRATEGIST', 'Builds strategy and report deliverables', '["create_reports","create_strategies","manage_keywords"]', true, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'STRATEGIST');--> statement-breakpoint
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), 'CLIENT_ADMIN', 'Client power user with collaboration access', '["view_portal","manage_feedback"]', true, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'CLIENT_ADMIN');--> statement-breakpoint
INSERT INTO `roles` (`id`, `name`, `description`, `permissions`, `is_system`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(16))), 'CLIENT_VIEWER', 'Client read-only portal access', '["view_portal"]', true, unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `roles` WHERE `name` = 'CLIENT_VIEWER');
