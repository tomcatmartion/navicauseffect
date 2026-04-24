#!/usr/bin/env bash
# 修复「用户名或密码错误」：确保 Prisma 客户端包含 username 字段并清掉 Next 缓存
set -e
cd "$(dirname "$0")/.."
echo "1. 重新生成 Prisma Client..."
npx prisma generate
echo "2. 清除 Next.js 缓存..."
rm -rf .next
echo "3. 校验 admin 账号（数据库）..."
npx tsx scripts/check-admin-db.ts
echo ""
echo "请重新启动开发服务器: npm run dev"
echo "然后使用 admin / <ADMIN_PASSWORD 环境变量对应的密码> 登录。"
