CREATE TABLE `plaza_custom_tab` (
  `id`           int NOT NULL AUTO_INCREMENT,
  `code`         varchar(32) NOT NULL,
  `name`         varchar(20) NOT NULL,
  `logo`         varchar(255) NULL,
  `template_ids` json NOT NULL,
  `sort_order`   int NOT NULL DEFAULT 0,
  `is_visible`   tinyint NOT NULL DEFAULT 1,
  `start_time`   bigint NULL,
  `end_time`     bigint NULL,
  `created_at`   bigint NOT NULL,
  `updated_at`   bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_plaza_custom_tab_code` (`code`),
  KEY `idx_plaza_custom_tab_visible_sort` (`is_visible`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
