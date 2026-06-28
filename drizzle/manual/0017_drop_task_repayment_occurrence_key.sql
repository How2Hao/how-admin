-- 还款账期改为复用 job_recurring_occurrence.id：
-- task.source_job_occurrence_id 统一指向对应 job occurrence。
-- 清理上一版临时引入的 source_repayment_occurrence_key 字段。

SET @idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'task'
    AND index_name = 'idx_task_source_repayment_occurrence'
);

SET @ddl = IF(
  @idx_exists > 0,
  'ALTER TABLE `task` DROP INDEX `idx_task_source_repayment_occurrence`',
  'SELECT ''idx_task_source_repayment_occurrence not exists'''
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'task'
    AND column_name = 'source_repayment_occurrence_key'
);

SET @ddl = IF(
  @col_exists > 0,
  'ALTER TABLE `task` DROP COLUMN `source_repayment_occurrence_key`',
  'SELECT ''source_repayment_occurrence_key not exists'''
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
