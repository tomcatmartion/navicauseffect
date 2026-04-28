#!/bin/bash
# ──────────────────────────────────────────────────────────────
# 紫微心理 — 生产环境启动脚本
#
# 用法：
#   bash scripts/start-prod.sh          # 前台运行
#   bash scripts/start-prod.sh daemon   # PM2 后台运行
# ──────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

echo "=== 紫微心理 生产环境启动 ==="

# 0. 前置检查
if [ ! -f "$APP_DIR/.env" ]; then
  echo "✗ 缺少 .env 文件，请先执行 bash scripts/install.sh"
  exit 1
fi

# 1. 确保数据目录存在
mkdir -p "$APP_DIR/data/zvec/sysknowledge_dim1536"
mkdir -p "$APP_DIR/data/zvec/sysknowledge_dim1024"

# 2. 清理残留锁和过期进度（防止上次中断导致卡死）
rm -f "$APP_DIR/data/zvec/.sysknowledge-reindex.lock" 2>/dev/null || true
rm -f "$APP_DIR/data/zvec/.index-progress.json" 2>/dev/null || true
rm -f "$APP_DIR/data/zvec/.retag-progress.json" 2>/dev/null || true
# 清理 collection 级别的空 LOCK 文件（进程异常退出后遗留）
find "$APP_DIR/data/zvec" -name 'LOCK' -size 0 -delete 2>/dev/null || true

# 3. 数据库迁移（用项目自带 prisma 版本）
echo "[1/2] 执行数据库迁移..."
PRISMA_CLI="./node_modules/.bin/prisma"
[ ! -x "$PRISMA_CLI" ] && PRISMA_CLI="npx prisma"
$PRISMA_CLI migrate deploy 2>&1 || echo "⚠ 迁移失败，如首次部署请先执行 bash scripts/install.sh"
echo "✓ 数据库迁移完成"

# 4. 启动服务
if [ "$1" = "daemon" ]; then
  echo "[2/2] PM2 后台启动..."
  HOSTNAME=0.0.0.0 pm2 start server.js --name navicauseffect
  pm2 save
  echo "✓ 已启动，使用 pm2 logs navicauseffect 查看日志"
else
  echo "[2/2] 启动服务..."
  echo "按 Ctrl+C 停止"
  HOSTNAME=0.0.0.0 node server.js
fi
