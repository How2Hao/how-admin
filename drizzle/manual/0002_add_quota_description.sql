-- 任务模板新增"名额限制说明"字段
-- 零停机：只是 nullable ADD COLUMN，无锁/无默认值回填
-- 执行：在生产 / 测试 mysql 上直接跑
-- 注：手写 SQL，未走 drizzle-kit migrate（schema 与 DB 历史已经不同步，drizzle generate 会产出大量无关变更）

ALTER TABLE `task_template`
  ADD COLUMN `quota_description` varchar(200) DEFAULT NULL
  COMMENT '名额限制说明（如"前 1000 名"、"先到先得"），从 extraConditionsText 中拆出';
