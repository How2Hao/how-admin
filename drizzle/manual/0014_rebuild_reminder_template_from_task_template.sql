-- 修复 reminder_template 生成规则：
-- 1. 清空旧 reminder_template 数据（包括误生成的 EXPIRY_REMINDER）。
-- 2. 按 task_template 一行一条重建 reminder_template，kind 固定为 REMINDER。
-- 3. 回写 task_template.reminder_template_id。

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

CALL add_col_if_missing('task_template', 'reminder_template_id', '`reminder_template_id` INT NULL COMMENT ''默认提醒模板 reminder_template.id'' AFTER `rule_source`');
CALL add_index_if_missing('task_template', 'idx_task_template_reminder_template', 'INDEX `idx_task_template_reminder_template` (`reminder_template_id`)');

UPDATE `task_template` SET `reminder_template_id` = NULL;
UPDATE `task` SET `reminder_template_id` = NULL WHERE `reminder_template_id` IS NOT NULL;
UPDATE `job_template` SET `reminder_template_id` = NULL WHERE `reminder_template_id` IS NOT NULL;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `reminder_template`;
SET FOREIGN_KEY_CHECKS = 1;

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
ORDER BY tt.`id`;

UPDATE `task_template` tt
JOIN `reminder_template` rt ON rt.`task_template_id` = tt.`id`
SET tt.`reminder_template_id` = rt.`id`;

UPDATE `task` t
JOIN `task_template` tt ON tt.`id` = t.`task_template_id`
SET t.`reminder_template_id` = tt.`reminder_template_id`
WHERE t.`task_template_id` IS NOT NULL;

UPDATE `job_template` jt
JOIN `task_template` tt ON tt.`id` = jt.`task_template_id`
SET jt.`reminder_template_id` = tt.`reminder_template_id`
WHERE jt.`task_template_id` IS NOT NULL;

CALL add_index_if_missing('reminder_template', 'uniq_reminder_template_task_template', 'UNIQUE INDEX `uniq_reminder_template_task_template` (`task_template_id`)');

DROP PROCEDURE IF EXISTS add_col_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
