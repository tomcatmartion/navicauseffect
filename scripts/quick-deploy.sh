#!/usr/bin/env bash
#
# 快速部署：本地 TS 检查 → 同步代码 → 远程构建 → 重启
#
# 用法: bash scripts/quick-deploy.sh
#
set -euo pipefail

SERVER="root@119.45.168.110"
REMOTE="/opt/navicauseffect"
PW="FDsa1234!@#\$"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "════════════════════════════════════════"
echo "  快速部署"
echo "════════════════════════════════════════"
echo ""

# ─── 步骤 1: 本地 TS 检查（排除 __tests__ 目录）───
echo "[1/4] 本地 TypeScript 检查..."
cd "$PROJECT_DIR"
if pnpm tsc --noEmit 2>&1 | grep -v '__tests__' | grep 'error TS' | head -5 | grep -q .; then
  pnpm tsc --noEmit 2>&1 | grep -v '__tests__' | grep 'error TS' | head -10
  echo ""
  echo "  ✗ TS 有错误（非测试文件），先修复再部署"
  exit 1
else
  echo "  ✓ TS 检查通过"
fi


# ─── 步骤 2: 同步代码 ───
echo "[2/4] 同步 src/ + data/ 到服务器..."
sshpass -p "$PW" rsync -az --delete \
  --exclude='__tests__' \
  --exclude='*.test.ts' \
  --exclude='*.spec.ts' \
  --exclude='test-*.ts' \
  "$PROJECT_DIR/src/" \
  "$SERVER:$REMOTE/src/"

sshpass -p "$PW" rsync -az \
  "$PROJECT_DIR/data/" \
  "$SERVER:$REMOTE/data/"

sshpass -p "$PW" rsync -az --delete \
  "$PROJECT_DIR/sysfiles/" \
  "$SERVER:$REMOTE/sysfiles/"

sshpass -p "$PW" rsync -az \
  "$PROJECT_DIR/prisma/" \
  "$SERVER:$REMOTE/prisma/"

echo "  ✓ 文件同步完成"

# ─── 步骤 3: 远程构建 ───
echo "[3/4] 远程构建..."
sshpass -p "$PW" ssh "$SERVER" "cd $REMOTE && pnpm build 2>&1 | tail -3"

echo "  ✓ 构建完成"

# ─── 步骤 4: 复制静态资源 + 重启 ───
echo "[4/4] 复制静态资源并重启服务..."
sshpass -p "$PW" ssh "$SERVER" "
cd $REMOTE
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
fuser -k 3000/tcp 2>/dev/null
sleep 2
cd .next/standalone
HOSTNAME=0.0.0.0 PORT=3000 nohup node server.js > /tmp/next.log 2>&1 &
sleep 5
CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
echo \"  HTTP \$CODE\"
"

echo ""
echo "════════════════════════════════════════"
echo "  部署完成"
echo "════════════════════════════════════════"
