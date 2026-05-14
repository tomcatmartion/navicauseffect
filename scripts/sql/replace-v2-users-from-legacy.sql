-- 将 navicauseffect_v2.users 与 navicauseffect.users 对齐为「仅旧库用户集 + 列级一致」。
-- 会删除 v2 中 id 不在旧库的用户行（级联删 memberships / payment_orders 等）；
-- 会删除 ziwei_sessions 中指向这些用户的行（该表无外键）。
-- 执行前请备份。

START TRANSACTION;

DELETE FROM navicauseffect_v2.ziwei_sessions
WHERE user_id NOT IN (SELECT id FROM navicauseffect.users);

DELETE FROM navicauseffect_v2.users
WHERE id NOT IN (SELECT id FROM navicauseffect.users);

UPDATE navicauseffect_v2.users v
INNER JOIN navicauseffect.users o ON v.id = o.id
SET
  v.phone = o.phone,
  v.email = o.email,
  v.wechat_openid = o.wechat_openid,
  v.nickname = o.nickname,
  v.avatar = o.avatar,
  v.password = o.password,
  v.role = o.role,
  v.bonus_queries = o.bonus_queries,
  v.total_points = o.total_points,
  v.invite_code = o.invite_code,
  v.created_at = o.created_at,
  v.updated_at = o.updated_at,
  v.username = o.username;

COMMIT;
