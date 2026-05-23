-- App 版本：
-- 1) app_release 增加文章字段（已发布版本承载文章，供 ha 渲染）。不加 status —— ha/hi 只读 app_release，
--    里面的行天然都是「已发布」，无需任何过滤改动。
-- 2) 草稿单独建表 app_release_draft（仅 how-admin 读写，ha/hi 完全不感知）。新版本先存草稿编辑/预览，
--    发布时再把内容写入 app_release。
ALTER TABLE `app_release`
  ADD COLUMN `article` MEDIUMTEXT NULL,
  ADD COLUMN `article_title` VARCHAR(200) NULL;

CREATE TABLE IF NOT EXISTS `app_release_draft` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `version` VARCHAR(32) NOT NULL,
  `changelog` TEXT NOT NULL,
  `android_url` VARCHAR(500) NULL,
  `ios_url` VARCHAR(500) NULL,
  `is_mandatory` TINYINT NOT NULL DEFAULT 0,
  `published_at` BIGINT NOT NULL,
  `article` MEDIUMTEXT NULL,
  `article_title` VARCHAR(200) NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARSET = utf8mb4;
