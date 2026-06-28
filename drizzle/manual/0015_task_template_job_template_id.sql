-- task_template 增加 job_template_id，支持 activity/task_template 侧显式选择关联 job_template。
-- 同步策略：
-- 1. task_template.job_template_id 是 admin 编辑活动模板时的直接配置项；
-- 2. 兼容已有 job_template.task_template_id，先反向回填；
-- 3. 后续 admin 保存活动模板时会同步维护 job_template.task_template_id。

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

CALL add_col_if_missing('task_template', 'job_template_id', '`job_template_id` INT NULL COMMENT ''关联的 job_template.id'' AFTER `reminder_template_id`');
CALL add_index_if_missing('task_template', 'idx_task_template_job_template', 'INDEX `idx_task_template_job_template` (`job_template_id`)');

UPDATE `task_template` tt
JOIN `job_template` jt ON jt.`task_template_id` = tt.`id`
SET tt.`job_template_id` = jt.`id`
WHERE tt.`job_template_id` IS NULL;

DROP PROCEDURE IF EXISTS add_col_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;
