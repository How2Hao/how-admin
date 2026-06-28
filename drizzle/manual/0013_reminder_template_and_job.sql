-- reminder_template + job 体系
--
-- 设计原则：
-- 1. task_template 表名保持不变，语义上作为 activity_template 使用。
-- 2. reminder_template 承接原 task_template 中的提醒模板规则；由 task_template 一行一条镜像生成，kind 固定为 REMINDER。
-- 3. job_template/job/job_recurring/job_recurring_occurrence 参考 task 体系，但 job 在周期内持续展示，不要求具体提醒时间。
-- 4. job_template 新设计只关联 task_template；历史 bank/card/region 字段暂不删除，避免旧 admin 页面和旧数据一次性破坏。
-- 5. 还款任务复用 job：progress_amount=本期账单金额，occurrence_start_at=账单日，occurrence_end_at=还款日。

DELIMITER $$

DROP PROCEDURE IF EXISTS add_col_if_missing$$
CREATE PROCEDURE add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  DECLARE col_count INT DEFAULT 0;
  SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = tbl AND column_name = col;
  IF col_count = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE s FROM @sql;
    EXECUTE s;
    DEALLOCATE PREPARE s;
  END IF;
END$$

DROP PROCEDURE IF EXISTS add_index_if_missing$$
CREATE PROCEDURE add_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  DECLARE idx_count INT DEFAULT 0;
  SELECT COUNT(*) INTO idx_count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = tbl AND index_name = idx;
  IF idx_count = 0 THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD ', ddl);
    PREPARE s FROM @sql;
    EXECUTE s;
    DEALLOCATE PREPARE s;
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- task：提醒实例类型扩展 + job/reminder 来源回溯
-- ============================================================

CALL add_col_if_missing('task', 'reminder_template_id', '`reminder_template_id` INT NULL COMMENT ''来源 reminder_template.id'' AFTER `task_template_id`');
CALL add_col_if_missing('task', 'source_job_id', '`source_job_id` INT NULL COMMENT ''来源 job.id，job 达标生成提醒时写入'' AFTER `reminder_template_id`');
CALL add_col_if_missing('task', 'source_job_occurrence_id', '`source_job_occurrence_id` INT NULL COMMENT ''来源 job_recurring_occurrence.id'' AFTER `source_job_id`');
CALL add_col_if_missing('task', 'kind', '`kind` ENUM(''TRACKING'',''REMINDER'',''EXPIRY_REMINDER'',''PIN'') NULL COMMENT ''TRACKING=达标记录, REMINDER=参与提醒, EXPIRY_REMINDER=到期提醒, PIN=置顶'' AFTER `source_job_occurrence_id`');

ALTER TABLE `task`
  MODIFY COLUMN `kind` ENUM('TRACKING','REMINDER','EXPIRY_REMINDER','PIN') NULL COMMENT 'TRACKING=达标记录, REMINDER=参与提醒, EXPIRY_REMINDER=到期提醒, PIN=置顶';

CALL add_index_if_missing('task', 'idx_task_reminder_template', 'INDEX `idx_task_reminder_template` (`reminder_template_id`)');
CALL add_index_if_missing('task', 'idx_task_source_job', 'INDEX `idx_task_source_job` (`source_job_id`)');
CALL add_index_if_missing('task', 'idx_task_source_job_occurrence', 'INDEX `idx_task_source_job_occurrence` (`source_job_occurrence_id`)');

-- task_template：记录默认 reminder_template + 可选 job_template，一对一回溯
CALL add_col_if_missing('task_template', 'reminder_template_id', '`reminder_template_id` INT NULL COMMENT ''默认提醒模板 reminder_template.id'' AFTER `rule_source`');
CALL add_col_if_missing('task_template', 'job_template_id', '`job_template_id` INT NULL COMMENT ''关联的 job_template.id'' AFTER `reminder_template_id`');
CALL add_index_if_missing('task_template', 'idx_task_template_reminder_template', 'INDEX `idx_task_template_reminder_template` (`reminder_template_id`)');
CALL add_index_if_missing('task_template', 'idx_task_template_job_template', 'INDEX `idx_task_template_job_template` (`job_template_id`)');

-- ============================================================
-- reminder_template：提醒模板，从 task_template 拆出
-- ============================================================

CREATE TABLE IF NOT EXISTS `reminder_template` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `task_template_id` INT NOT NULL COMMENT '所属活动模板 task_template.id',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `kind` ENUM('REMINDER','EXPIRY_REMINDER') NOT NULL DEFAULT 'REMINDER',
  `repeat_type` ENUM('ONE_TIME','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONE_TIME',
  `date` BIGINT NULL COMMENT '一次性提醒日期或循环锚点(epoch ms)',
  `start_date` BIGINT NULL COMMENT '模板有效期起(epoch ms)',
  `end_date` BIGINT NULL COMMENT '模板有效期止(epoch ms)',
  `days_of_week` VARCHAR(50) NULL,
  `days_of_month` VARCHAR(200) NULL,
  `yearly_months` VARCHAR(100) NULL,
  `yearly_days_of_month` VARCHAR(200) NULL,
  `reminder_time` VARCHAR(10) NULL COMMENT 'HH:mm',
  `advance_reminder_minutes` SMALLINT NULL,
  `is_visible` TINYINT NOT NULL DEFAULT 1,
  `created_at` BIGINT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_reminder_template_task_template` (`task_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 从 task_template 一行一条镜像生成默认 REMINDER 模板，不推导 EXPIRY_REMINDER。
INSERT INTO `reminder_template` (
  `task_template_id`, `title`, `description`, `kind`, `repeat_type`, `date`,
  `start_date`, `end_date`, `days_of_week`, `days_of_month`, `yearly_months`,
  `yearly_days_of_month`, `reminder_time`, `advance_reminder_minutes`,
  `is_visible`, `created_at`, `updated_at`
)
SELECT
  tt.`id`, tt.`title`, tt.`rule_detail`, 'REMINDER', tt.`repeat_type`, tt.`date`,
  tt.`start_date`, tt.`end_date`, tt.`days_of_week`, tt.`days_of_month`, tt.`yearly_months`,
  tt.`yearly_days_of_month`, tt.`reminder_time`, NULL,
  tt.`is_visible`, UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000, CURRENT_TIMESTAMP
FROM `task_template` tt
WHERE NOT EXISTS (
    SELECT 1 FROM `reminder_template` rt
    WHERE rt.`task_template_id` = tt.`id`
  );

UPDATE `task_template` tt
JOIN `reminder_template` rt ON rt.`task_template_id` = tt.`id`
SET tt.`reminder_template_id` = rt.`id`
WHERE tt.`reminder_template_id` IS NULL;

-- ============================================================
-- job_template：admin 维护的参与条件模板
-- ============================================================

CALL add_col_if_missing('job_template', 'description', '`description` TEXT NULL AFTER `title`');
CALL add_col_if_missing('job_template', 'date', '`date` BIGINT NULL COMMENT ''一次性 job 周期锚点(epoch ms)'' AFTER `repeat_type`');
CALL add_col_if_missing('job_template', 'days_of_week', '`days_of_week` VARCHAR(50) NULL AFTER `end_date`');
CALL add_col_if_missing('job_template', 'days_of_month', '`days_of_month` VARCHAR(200) NULL AFTER `days_of_week`');
CALL add_col_if_missing('job_template', 'yearly_months', '`yearly_months` VARCHAR(100) NULL AFTER `days_of_month`');
CALL add_col_if_missing('job_template', 'yearly_days_of_month', '`yearly_days_of_month` VARCHAR(200) NULL AFTER `yearly_months`');
CALL add_col_if_missing('job_template', 'reminder_template_id', '`reminder_template_id` INT NULL COMMENT ''达标后建议/自动创建 task 使用的 reminder_template.id'' AFTER `task_template_id`');
CALL add_col_if_missing('job_template', 'reward_window_rule', '`reward_window_rule` JSON NULL COMMENT ''结构化权益窗口规则，计算 reward_start_at/reward_end_at'' AFTER `reminder_template_id`');
CALL add_col_if_missing('job_template', 'reward_description', '`reward_description` VARCHAR(500) NULL COMMENT ''权益展示文案，如下月可抽奖5次'' AFTER `reward_window_rule`');

CALL add_index_if_missing('job_template', 'idx_job_template_reminder_template', 'INDEX `idx_job_template_reminder_template` (`reminder_template_id`)');

UPDATE `task_template` tt
JOIN `job_template` jt ON jt.`task_template_id` = tt.`id`
SET tt.`job_template_id` = jt.`id`
WHERE tt.`job_template_id` IS NULL;

-- ============================================================
-- job：用户侧任务实例（ACTIVITY/REPAYMENT）
-- ============================================================

CREATE TABLE IF NOT EXISTS `job` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `job_template_id` INT NULL COMMENT 'ACTIVITY 来源模板；REPAYMENT 可为空',
  `task_template_id` INT NULL COMMENT 'ACTIVITY 所属活动模板；REPAYMENT 为空',
  `source_type` ENUM('ACTIVITY','REPAYMENT') NOT NULL,
  `subject_type` ENUM('TASK_TEMPLATE','BANK','BANK_CARD') NOT NULL,
  `subject_id` INT NOT NULL COMMENT '由 subject_type 决定，指向 task_template/bank/bank_card',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `repeat_type` ENUM('ONE_TIME','DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'ONE_TIME',
  `status` ENUM('PENDING','IN_PROGRESS','COMPLETED','EXPIRED','ARCHIVED') NOT NULL DEFAULT 'PENDING',
  `created_at` BIGINT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_job_user_source` (`user_id`, `source_type`),
  KEY `idx_job_subject` (`subject_type`, `subject_id`),
  KEY `idx_job_template` (`job_template_id`),
  KEY `idx_job_task_template` (`task_template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- job_recurring：job 周期规则，命名和 task_recurring 对齐
-- ============================================================

CREATE TABLE IF NOT EXISTS `job_recurring` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `job_id` INT NOT NULL,
  `repeat_type` ENUM('DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL DEFAULT 'DAILY',
  `days_of_week` VARCHAR(50) NULL,
  `days_of_month` VARCHAR(200) NULL,
  `yearly_months` VARCHAR(100) NULL,
  `yearly_days_of_month` VARCHAR(200) NULL,
  `start_date` BIGINT NULL,
  `end_date` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_job_id` (`job_id`),
  KEY `idx_job_repeat_type` (`repeat_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- job_recurring_occurrence：周期实例/进度
-- ============================================================

CREATE TABLE IF NOT EXISTS `job_recurring_occurrence` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `job_id` INT NOT NULL,
  `cycle_key` VARCHAR(64) NOT NULL COMMENT '周期唯一键，如 2026-06 / 2026-W23',
  `occurrence_start_at` BIGINT NOT NULL COMMENT 'ACTIVITY=达标周期起；REPAYMENT=账单日',
  `occurrence_end_at` BIGINT NOT NULL COMMENT 'ACTIVITY=达标周期止；REPAYMENT=还款日',
  `reward_start_at` BIGINT NULL COMMENT 'ACTIVITY 达标后权益窗口起；REPAYMENT 为空',
  `reward_end_at` BIGINT NULL COMMENT 'ACTIVITY 达标后权益窗口止；REPAYMENT 为空',
  `status` ENUM('PENDING','IN_PROGRESS','COMPLETED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `progress_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'ACTIVITY=消费/支付金额；REPAYMENT=本期账单金额',
  `progress_count` INT NOT NULL DEFAULT 0 COMMENT 'ACTIVITY=消费/支付笔数；REPAYMENT 可为 0',
  `completed_at` BIGINT NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_job_occurrence` (`job_id`, `cycle_key`),
  KEY `idx_job_occurrence_window` (`occurrence_start_at`, `occurrence_end_at`),
  KEY `idx_job_occurrence_reward_window` (`reward_start_at`, `reward_end_at`),
  KEY `idx_job_occurrence_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS add_col_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
