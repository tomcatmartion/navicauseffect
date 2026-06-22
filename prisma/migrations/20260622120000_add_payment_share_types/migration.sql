-- 阶段 1：扩展 PaymentType / PointSource / SharePlatform enum + ShareRecord 新字段

-- PaymentType：新增 COIN_PACK / CREDIT_PACK（用于星币充值包与按次卡订单）
ALTER TABLE `payment_orders` MODIFY `type` ENUM('MEMBERSHIP', 'PER_QUERY', 'COIN_PACK', 'CREDIT_PACK') NOT NULL;

-- PointSource：新增 COIN_PACK / CREDIT_PACK / PURCHASE_REBATE
ALTER TABLE `point_records` MODIFY `source` ENUM('SHARE', 'ADMIN_GRANT', 'REDEEM', 'INVITE', 'RECHARGE', 'CONSUME', 'COIN_PACK', 'CREDIT_PACK', 'PURCHASE_REBATE') NOT NULL;

-- SharePlatform：新增 WEIBO / QQ / LINK / QRCODE / REDBOOK / ZHIHU
ALTER TABLE `share_records` MODIFY `platform` ENUM('WECHAT', 'MOMENTS', 'WEIBO', 'QQ', 'LINK', 'QRCODE', 'REDBOOK', 'ZHIHU') NOT NULL;

-- ShareRecord 新字段：reward_points（本次分享获得奖励）+ clicks（被点击次数）
ALTER TABLE `share_records` ADD COLUMN `reward_points` INT NOT NULL DEFAULT 0 AFTER `share_url`;
ALTER TABLE `share_records` ADD COLUMN `clicks` INT NOT NULL DEFAULT 0 AFTER `reward_points`;

-- ShareRecord 加索引（按用户查分享历史）
CREATE INDEX `share_records_user_id_idx` ON `share_records`(`user_id`);
