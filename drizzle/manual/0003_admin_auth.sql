-- 管理员账号 + 会话表
-- 零停机：纯 CREATE TABLE，不动其它表
-- 注：跟 0002 一样手写，不走 drizzle-kit migrate

CREATE TABLE `admin_user` (
  `id` int AUTO_INCREMENT NOT NULL,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100),
  `role` varchar(32) NOT NULL DEFAULT 'ADMIN',
  `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` bigint,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_user_username` (`username`)
);

CREATE TABLE `admin_session` (
  `id` int AUTO_INCREMENT NOT NULL,
  `admin_user_id` int NOT NULL,
  `token` char(64) NOT NULL,
  `expires_at` bigint NOT NULL,
  `revoked_at` bigint,
  `ip` varchar(64),
  `user_agent` varchar(500),
  `last_used_at` bigint,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_session_token` (`token`),
  KEY `idx_admin_session_admin_user` (`admin_user_id`)
);
