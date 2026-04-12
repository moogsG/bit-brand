DROP TABLE `ahrefs_metrics`;--> statement-breakpoint
DROP TABLE `semrush_metrics`;--> statement-breakpoint
ALTER TABLE `ai_visibility` DROP COLUMN `semrush_score`;--> statement-breakpoint
ALTER TABLE `data_sources` DROP COLUMN `credentials_enc`;--> statement-breakpoint
ALTER TABLE `data_sources` DROP COLUMN `property_id`;--> statement-breakpoint
ALTER TABLE `data_sources` DROP COLUMN `site_url`;--> statement-breakpoint
ALTER TABLE `data_sources` DROP COLUMN `access_token`;--> statement-breakpoint
ALTER TABLE `data_sources` DROP COLUMN `refresh_token`;--> statement-breakpoint
ALTER TABLE `data_sources` DROP COLUMN `token_expires_at`;