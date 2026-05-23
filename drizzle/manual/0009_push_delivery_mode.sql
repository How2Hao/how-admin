-- push_task 新增「下发方式」字段
-- 零停机：ADD COLUMN 带默认值，存量行回填 APNS（= 现行为，横幅+消息中心）
-- 注：手写 SQL，不走 drizzle-kit migrate（与 0002~0008 一致）
-- 执行：在生产 / 测试 mysql 上直接跑

ALTER TABLE `push_task`
  ADD COLUMN `delivery_mode` varchar(20) NOT NULL DEFAULT 'APNS'
  COMMENT '下发方式：APNS=横幅+消息中心；INBOX=仅消息中心（永不发横幅）';
