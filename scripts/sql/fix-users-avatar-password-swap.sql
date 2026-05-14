-- 修复错误导入：bcrypt 被写入 avatar，password 列误存 USER/ADMIN 字符串。
-- 执行前请备份；在事务中运行更安全。
-- 库名按环境修改（示例为 navicauseffect_v2）。

START TRANSACTION;

UPDATE navicauseffect_v2.users
SET password = avatar, avatar = NULL
WHERE (avatar LIKE '$2b$%' OR avatar LIKE '$2a$%')
  AND password IN ('USER', 'ADMIN');

-- 若存在 navicauseffect 旧库，仅同步 role（避免 username 唯一键冲突）
UPDATE navicauseffect_v2.users v
INNER JOIN navicauseffect.users o ON v.id = o.id
SET v.role = o.role
WHERE BINARY v.role <> BINARY o.role;

COMMIT;
