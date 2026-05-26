-- 使用平台备注:平台自身属性,全局共享;空表示无备注
ALTER TABLE `benefit_usage_platform`
  ADD COLUMN `remark` VARCHAR(255) NULL AFTER `icon`;
