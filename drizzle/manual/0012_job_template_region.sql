-- job_template 新增地区匹配字段（对齐 task_template 设计）
-- region_code: 地区码（100000=全国，省级6位，地市级6位），null=不限地区
-- region_match_strategy: EXACT（精确匹配）| INCLUDE_ALL（省含全部地市）| EXCLUDE_PLAN_SINGLE_CITY（省排除计划单列市）
ALTER TABLE `job_template`
  ADD COLUMN `region_code` varchar(20) NULL AFTER `bank_card_template_id`,
  ADD COLUMN `region_match_strategy` varchar(255) NULL AFTER `region_code`;
