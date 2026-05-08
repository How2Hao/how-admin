-- admin_user 加头像字段
-- 零停机：纯 ADD COLUMN nullable

ALTER TABLE `admin_user`
  ADD COLUMN `avatar` varchar(500) DEFAULT NULL
  COMMENT '管理员头像 URL（OSS 完整地址或外链）';
