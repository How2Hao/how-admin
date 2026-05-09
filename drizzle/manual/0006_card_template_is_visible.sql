-- bank_card_template 加 is_visible：admin Switch 控制对外展示
-- 回填规则：51credit→0（隐藏，admin 待发布），flyert→1（已发布）
-- MySQL 8 ALGORITHM=INSTANT 加列即时完成，零停机

ALTER TABLE `bank_card_template`
  ADD COLUMN `is_visible` TINYINT(1) NOT NULL DEFAULT 1
  COMMENT '是否对外展示（admin Switch 控制；ha 后续 PR 切换查询条件用此字段）'
  AFTER `cover`;

UPDATE `bank_card_template` SET `is_visible` = 0 WHERE `data_source` = '51credit';
UPDATE `bank_card_template` SET `is_visible` = 1 WHERE `data_source` = 'flyert';
