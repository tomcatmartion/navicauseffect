-- 与库 navicauseffect.users 列顺序对齐：username 置于 updated_at 之后（仅列序，类型与索引不变）
ALTER TABLE `users`
  MODIFY COLUMN `username` varchar(191) COLLATE utf8mb4_unicode_ci NULL AFTER `updated_at`;
