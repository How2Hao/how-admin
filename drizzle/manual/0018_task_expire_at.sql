-- EXPIRY_REMINDER 使用独立过期时间：
-- reminder_time 仍表示真实提醒触发时间，expire_at 表示卡券/权益业务截止时间。

SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'task'
    AND column_name = 'expire_at'
);

SET @ddl = IF(
  @col_exists = 0,
  'ALTER TABLE `task` ADD COLUMN `expire_at` BIGINT NULL COMMENT ''卡券/权益过期时间(epoch ms)，仅 EXPIRY_REMINDER 使用'' AFTER `reminder_time`',
  'SELECT ''expire_at already exists'''
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
