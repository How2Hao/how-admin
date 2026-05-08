-- task_template 加 admin_user_id（创建/维护者，指向 admin_user.id）
-- 现有所有行自动回填为 1（DEFAULT 1 + ADD COLUMN NOT NULL）
-- 零停机：MySQL 8 支持 ALGORITHM=INSTANT 加列；带 DEFAULT 也是即时操作

ALTER TABLE `task_template`
  ADD COLUMN `admin_user_id` int NOT NULL DEFAULT 1
  COMMENT '创建/维护者 admin_user.id；老数据默认 1';

CREATE INDEX `idx_task_template_admin_user` ON `task_template` (`admin_user_id`);
