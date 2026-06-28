-- job_template：独立的"真正的任务模板"（周期性前置/通用任务，无提醒时刻）
-- 三个维度逻辑外键(task_template_id/bank_id/bank_card_template_id)均可空、可多填；不加物理外键约束，对齐现有表风格
CREATE TABLE `job_template` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `repeat_type` enum('ONE_TIME','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONE_TIME',
  `start_date` bigint NULL COMMENT '模板整体有效期起(epoch ms)',
  `end_date` bigint NULL COMMENT '模板整体有效期止(epoch ms)',
  `tiers` json NOT NULL COMMENT '档位数组,>=1;每档{minAmount,minCount,logic,description}',
  `task_template_id` int NULL COMMENT '维度①关联活动(task_template.id)',
  `bank_id` int NULL COMMENT '维度②关联银行(bank.id)',
  `bank_card_template_id` int NULL COMMENT '维度③关联模板银行卡(bank_card_template.id)',
  `admin_user_id` int NOT NULL DEFAULT 1 COMMENT '创建/维护者 admin_user.id',
  `is_visible` tinyint NOT NULL DEFAULT 0,
  `created_at` bigint NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_template_admin_user` (`admin_user_id`),
  KEY `idx_job_template_task_template` (`task_template_id`),
  KEY `idx_job_template_bank` (`bank_id`),
  KEY `idx_job_template_card` (`bank_card_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
