-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `acc_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`type` enum('INCOME','EXPENSE') NOT NULL DEFAULT 'EXPENSE',
	`name` varchar(50) NOT NULL,
	`icon` varchar(200),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_system` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL DEFAULT 0,
	CONSTRAINT `acc_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `acc_ledgers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`icon` varchar(20),
	`currency` varchar(10) NOT NULL DEFAULT 'CNY',
	`is_default` tinyint(1) NOT NULL DEFAULT 0,
	`created_at` bigint NOT NULL DEFAULT 0,
	`updated_at` bigint NOT NULL DEFAULT 0,
	CONSTRAINT `acc_ledgers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `acc_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ledger_id` int NOT NULL,
	`acc_user_id` int,
	`category_id` int NOT NULL,
	`type` enum('INCOME','EXPENSE') NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`account` varchar(50),
	`bank` varchar(50),
	`bank_id` varchar(50),
	`bank_card_id` int,
	`benefit_platform_id` int,
	`transaction_date` bigint NOT NULL,
	`description` text,
	`remark` varchar(500),
	`created_at` bigint NOT NULL DEFAULT 0,
	`updated_at` bigint NOT NULL DEFAULT 0,
	`related_income_id` int,
	CONSTRAINT `acc_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `acc_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(50) NOT NULL,
	`email` varchar(100) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`avatar` varchar(500),
	`created_at` bigint NOT NULL DEFAULT 0,
	`updated_at` bigint NOT NULL DEFAULT 0,
	CONSTRAINT `acc_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_username` UNIQUE(`username`),
	CONSTRAINT `uniq_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `app` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`logo` varchar(255),
	`ios_schema_url` varchar(255),
	`android_schema_url` varchar(255),
	`bank_id` int,
	CONSTRAINT `app_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`short_name` varchar(50),
	`pinyin_index` varchar(100),
	`code` varchar(50),
	`logo` varchar(255),
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`theme_color` varchar(255),
	`credit_card_count` int,
	`source` varchar(255),
	`is_unified_bill` tinyint(1) NOT NULL DEFAULT 0,
	CONSTRAINT `bank_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_card` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bank_id` varchar(50) NOT NULL DEFAULT '',
	`card_name` varchar(255),
	`card_level` varchar(255),
	`card_class` int,
	`card_type` varchar(20) NOT NULL,
	`card_organization` varchar(50) NOT NULL DEFAULT 'UNIONPAY',
	`cover` varchar(500),
	`region_code` varchar(20) NOT NULL,
	`card_last_four` varchar(10) NOT NULL,
	`credit_limit` double,
	`annual_fee_type` varchar(20),
	`rigid_fee_amount` double,
	`waiver_method` varchar(30),
	`waiver_value` double,
	`fee_month` int,
	`fee_day` int,
	`statement_day` int,
	`repayment_rule_type` varchar(32),
	`repayment_day` int,
	`repayment_offset_days` int,
	`max_interest_free_days` int,
	`available_limit` double,
	`currency` varchar(8) NOT NULL DEFAULT 'CNY',
	`expiry` char(6),
	`created_at` bigint NOT NULL,
	`updated_at` bigint,
	`template_id` int,
	CONSTRAINT `bank_card_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_card_template` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bank_id` varchar(50) NOT NULL,
	`card_name` varchar(255) NOT NULL,
	`card_type` varchar(20) NOT NULL,
	`card_level` varchar(255),
	`card_organization` varchar(50) NOT NULL DEFAULT 'UNIONPAY',
	`cover` varchar(500),
	`province_code` varchar(20),
	`province_name` varchar(50),
	`city_code` varchar(20),
	`city_name` varchar(50),
	`card_last_four` varchar(10),
	`credit_limit` double,
	`annual_fee_type` varchar(20),
	`rigid_fee_amount` double,
	`waiver_method` varchar(30),
	`waiver_value` double,
	`fee_month` int,
	`fee_day` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint,
	CONSTRAINT `bank_card_template_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_sms_rule` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`bank_id` varchar(50) NOT NULL,
	`bank_name` varchar(100) NOT NULL,
	`sms_numbers_csv` varchar(500) NOT NULL,
	`sms_template` text NOT NULL,
	`is_enabled` tinyint(1) NOT NULL DEFAULT 1,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `bank_sms_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_bank_sms_rule_bank_id` UNIQUE(`bank_id`)
);
--> statement-breakpoint
CREATE TABLE `benefit_category` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`icon` varchar(200),
	`sort_order` int NOT NULL DEFAULT 0,
	`acc_category_id` int,
	`benefit_platform_ids` varchar(255),
	CONSTRAINT `benefit_category_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `benefit_platform` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(50) NOT NULL,
	`icon` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `benefit_platform_id` PRIMARY KEY(`id`),
	CONSTRAINT `code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `card_level` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	CONSTRAINT `card_level_id` PRIMARY KEY(`id`),
	CONSTRAINT `id` UNIQUE(`id`)
);
--> statement-breakpoint
CREATE TABLE `card_organization` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`logo` varchar(255) NOT NULL DEFAULT '',
	CONSTRAINT `card_organization_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `region` (
	`region_code` varchar(20) NOT NULL,
	`region_name` varchar(50),
	`parent_code` varchar(20),
	`level` int,
	`region_type` varchar(20) DEFAULT 'NORMAL',
	`is_plan_single_city` tinyint DEFAULT 0,
	CONSTRAINT `region_region_code` PRIMARY KEY(`region_code`)
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`date` bigint,
	`repeat_type` enum('ONE_TIME','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONE_TIME',
	`reminder_time` varchar(10),
	`high_priority` tinyint NOT NULL DEFAULT 0,
	`advance_reminder_minutes` smallint,
	`status` enum('PENDING','EXPIRED','COMPLETED') NOT NULL DEFAULT 'PENDING',
	`region_type` enum('NATIONWIDE','REGIONAL') NOT NULL DEFAULT 'NATIONWIDE',
	`region_code` varchar(20),
	`region_province_name` varchar(50),
	`region_city_name` varchar(50),
	`bank_id` varchar(50),
	`bank_card_id` int,
	`bank_card_type` varchar(255),
	`bank_card_level` int,
	`bank_card_organization` text,
	`task_template_id` int,
	`benefit_category_id` int,
	`benefit_amount` decimal(10,2),
	`benefit_voucher_description` varchar(500),
	`benefit_platform_id` int,
	`frequency_control` varchar(100),
	`created_at` bigint NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `task_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_recurring` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`repeat_type` enum('DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'DAILY',
	`days_of_week` varchar(50),
	`days_of_month` varchar(200),
	`yearly_months` varchar(100),
	`yearly_days_of_month` varchar(200),
	`start_date` bigint,
	`end_date` bigint,
	`reminder_time` varchar(10),
	`created_at` bigint NOT NULL DEFAULT 0,
	`updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `task_recurring_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_task_id` UNIQUE(`task_id`)
);
--> statement-breakpoint
CREATE TABLE `task_recurring_occurrence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int NOT NULL,
	`occurrence_date` bigint NOT NULL,
	`status` enum('PENDING','EXPIRED','COMPLETED') NOT NULL DEFAULT 'PENDING',
	`is_completed` tinyint NOT NULL DEFAULT 0,
	`completed_at` bigint,
	`created_at` bigint NOT NULL DEFAULT 0,
	`updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `task_recurring_occurrence_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_task_occurrence` UNIQUE(`task_id`,`occurrence_date`)
);
--> statement-breakpoint
CREATE TABLE `task_template` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`date` bigint,
	`bank_id` int NOT NULL,
	`bank_card_organization` varchar(255),
	`bank_card_template_id` int,
	`bank_card_type` varchar(255),
	`bank_card_level` int,
	`region_code` varchar(255),
	`region_match_strategy` varchar(255),
	`repeat_type` enum('ONE_TIME','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONE_TIME',
	`days_of_week` varchar(50),
	`days_of_month` varchar(200),
	`yearly_months` varchar(100),
	`yearly_days_of_month` varchar(200),
	`reminder_time` varchar(10),
	`start_date` bigint,
	`end_date` bigint,
	`frequency_control` varchar(100),
	`high_priority` tinyint NOT NULL DEFAULT 0,
	`advance_reminder_minutes` smallint,
	`is_completed` tinyint NOT NULL DEFAULT 0,
	`status` enum('PENDING','EXPIRED','COMPLETED') NOT NULL DEFAULT 'PENDING',
	`created_at` bigint NOT NULL,
	`region_type` enum('NATIONWIDE','REGIONAL') NOT NULL DEFAULT 'NATIONWIDE',
	`benefit_category_id` int,
	`benefit_amount` decimal(10,2),
	`benefit_voucher_description` varchar(500),
	`benefit_platform_id` int,
	`activity_tag_code` varchar(32),
	`offer_summary_text` varchar(500),
	`updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`publisher` varchar(255),
	`publish_time` datetime(6),
	`likes` int DEFAULT 0,
	`add_count` int DEFAULT 0,
	`task_type` varchar(64),
	`participation_difficulty` varchar(16),
	`extra_conditions_text` text,
	`guide_type` varchar(16),
	`guide_text` text,
	`guide_url` varchar(500),
	`detailed_rule` text,
	CONSTRAINT `task_template_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_template_like` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_template_id` int NOT NULL,
	`user_id` int NOT NULL,
	`created_at` bigint NOT NULL DEFAULT 0,
	CONSTRAINT `task_template_like_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_task_template_like_user` UNIQUE(`task_template_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `acc_ledgers` ADD CONSTRAINT `fk_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `acc_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `acc_transactions` ADD CONSTRAINT `fk_txn_category` FOREIGN KEY (`category_id`) REFERENCES `acc_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `acc_transactions` ADD CONSTRAINT `fk_txn_ledger` FOREIGN KEY (`ledger_id`) REFERENCES `acc_ledgers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app` ADD CONSTRAINT `app_ibfk_1` FOREIGN KEY (`bank_id`) REFERENCES `bank`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_card` ADD CONSTRAINT `fk_template_id` FOREIGN KEY (`template_id`) REFERENCES `bank_card_template`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_cat_user_type` ON `acc_categories` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `idx_ledger_user` ON `acc_ledgers` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_txn_ledger` ON `acc_transactions` (`ledger_id`);--> statement-breakpoint
CREATE INDEX `idx_txn_category` ON `acc_transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_txn_date` ON `acc_transactions` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_related_income_id` ON `acc_transactions` (`related_income_id`);--> statement-breakpoint
CREATE INDEX `idx_acc_transactions_acc_user_id` ON `acc_transactions` (`acc_user_id`);--> statement-breakpoint
CREATE INDEX `bank_id` ON `app` (`bank_id`);--> statement-breakpoint
CREATE INDEX `FK_8f2b7ce439989da5dba4c6cc9de` ON `bank_card` (`bank_id`);--> statement-breakpoint
CREATE INDEX `idx_bank_sms_rule_enabled` ON `bank_sms_rule` (`is_enabled`);--> statement-breakpoint
CREATE INDEX `idx_acc_category_id` ON `benefit_category` (`acc_category_id`);--> statement-breakpoint
CREATE INDEX `idx_repeat_type` ON `task_recurring` (`repeat_type`);--> statement-breakpoint
CREATE INDEX `idx_occurrence_date` ON `task_recurring_occurrence` (`occurrence_date`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `task_recurring_occurrence` (`status`);--> statement-breakpoint
CREATE INDEX `idx_task_template_activity_tag_code` ON `task_template` (`activity_tag_code`);--> statement-breakpoint
CREATE INDEX `idx_task_template_like_template_id` ON `task_template_like` (`task_template_id`);--> statement-breakpoint
CREATE INDEX `idx_task_template_like_user_id` ON `task_template_like` (`user_id`);
*/