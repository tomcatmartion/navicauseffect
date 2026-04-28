#!/bin/bash
# ──────────────────────────────────────────────────────────────
# 紫微心理 — 服务器端一键安装脚本
#
# 在 Linux 服务器上解压 release tarball 后执行。
#
# 前置条件：
#   - Node.js 18+
#   - MySQL 8.0 可达（通过 .env 中 DATABASE_URL）
#
# 用法：
#   cd navicauseffect && bash scripts/install.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     紫微心理 · 服务器安装                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── 1. 环境检查 ──────────────────────────────────────────────

echo "[1/5] 检查运行环境..."

if ! command -v node &>/dev/null; then
  err "未找到 Node.js，请先安装 Node.js 18+"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  err "Node.js 版本过低（$(node -v)），需要 18+"
  exit 1
fi
log "Node.js $(node -v) OK"

# ─── 2. .env 配置 ────────────────────────────────────────────

echo "[2/5] 检查配置文件..."

if [ ! -f "$APP_DIR/.env" ]; then
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    warn "已从 .env.example 创建 .env"
    echo ""
    echo -e "  ${YELLOW}请编辑 .env 配置数据库连接和 API Key：${NC}"
    echo -e "  ${CYAN}vim $APP_DIR/.env${NC}"
    echo ""
    echo "  必填项："
    echo "    DATABASE_URL      — MySQL 连接串"
    echo "    NEXTAUTH_SECRET   — 随机密钥（可用 openssl rand -base64 32 生成）"
    echo "    NEXTAUTH_URL      — 服务器访问地址"
    echo ""
    echo "  编辑完成后重新运行此脚本。"
    exit 0
  else
    err ".env.example 不存在，请检查发布包完整性"
    exit 1
  fi
fi
log ".env 已存在"

# ─── 3. 创建必要目录 ──────────────────────────────────────────

echo "[3/5] 创建数据目录..."

mkdir -p "$APP_DIR/data/zvec/sysknowledge_dim1536"
mkdir -p "$APP_DIR/data/zvec/sysknowledge_dim1024"

rm -f "$APP_DIR/data/zvec/.sysknowledge-reindex.lock" 2>/dev/null || true
rm -f "$APP_DIR/data/zvec/.index-progress.json" 2>/dev/null || true
rm -f "$APP_DIR/data/zvec/.retag-progress.json" 2>/dev/null || true

mkdir -p "$APP_DIR/sysfiles/systag"
mkdir -p "$APP_DIR/sysfiles/sysknowledge"

log "数据目录就绪"

# ─── 4. 数据库初始化 ─────────────────────────────────────────

echo "[4/5] 初始化数据库..."

cd "$APP_DIR"

# 4a. 自动创建数据库（如果不存在）
if [ -f "$APP_DIR/.env" ] && command -v mysql &>/dev/null; then
  DB_URL=$(grep '^DATABASE_URL=' "$APP_DIR/.env" | head -1 | sed 's/DATABASE_URL=//' | tr -d '"' | tr -d "'")
  if [ -n "$DB_URL" ]; then
    DB_NAME=$(echo "$DB_URL" | sed 's|.*/\([^?]*\).*|\1|')
    DB_HOST=$(echo "$DB_URL" | sed 's|.*@\([^:]*\):.*|\1|')
    DB_PORT=$(echo "$DB_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')
    DB_USER=$(echo "$DB_URL" | sed 's|mysql://\([^:]*\):.*|\1|')
    DB_PASS=$(echo "$DB_URL" | sed 's|mysql://[^:]*:\([^@]*\)@.*|\1|')

    if [ -n "$DB_NAME" ] && [ -n "$DB_HOST" ] && [ -n "$DB_USER" ]; then
      echo "  创建数据库 $DB_NAME（如不存在）..."
      mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "${DB_PORT:-3306}" \
        -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
        2>/dev/null && log "数据库 $DB_NAME 就绪" || \
        warn "自动建库失败，继续尝试同步表结构..."
    fi
  fi
fi

# 4b. 同步表结构（本地 prisma CLI 优先，回退到 npx 指定版本）
PRISMA_CLI="./node_modules/.bin/prisma"
if ! $PRISMA_CLI --version &>/dev/null; then
  warn "本地 prisma CLI 不可用，使用 npx 拉取..."
  PRISMA_CLI="npx --yes prisma@6"
fi

echo "  同步表结构..."
$PRISMA_CLI db push 2>&1 && log "表结构同步完成" || {
  err "表结构同步失败，请检查 .env 中的 DATABASE_URL"
  exit 1
}

# 4c. 创建管理员
echo "  创建管理员账号..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existing) {
    const hash = await bcrypt.hash('ffffff', 10);
    await prisma.user.create({
      data: { username: 'admin', nickname: '管理员', password: hash, role: 'ADMIN', inviteCode: 'ADMIN001' }
    });
    console.log('[✓] 管理员创建成功：admin / ffffff');
  } else {
    console.log('[✓] 管理员已存在');
  }
  await prisma.\\$disconnect();
})();
" 2>&1 || warn "管理员创建失败（可稍后手动创建）"

# 4d. 初始化 AI 模型配置（从 .env 读取 API Key）
echo "  初始化 AI 模型配置..."
node "$APP_DIR/scripts/seed-ai-models.js" 2>&1 || warn "AI 模型初始化失败（可在管理后台手动配置）"

# ─── 5. 验证 ────────────────────────────────────────────────

echo "[5/5] 验证部署完整性..."

ERRORS=0

if [ -f "$APP_DIR/node_modules/.prisma/client/libquery_engine-rhel-openssl-1.1.x.so.node" ]; then
  log "Prisma Linux 引擎 OK"
else
  err "Prisma Linux 引擎缺失"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "$APP_DIR/node_modules/@zvec/bindings-linux-x64/zvec_node_binding.node" ]; then
  log "zvec Linux 绑定 OK"
else
  err "zvec Linux 绑定缺失"
  ERRORS=$((ERRORS + 1))
fi

if [ -d "$APP_DIR/sysfiles/systag" ] && [ "$(ls -A "$APP_DIR/sysfiles/systag" 2>/dev/null)" ]; then
  log "标签定义文件 OK"
else
  warn "sysfiles/systag 为空（可在管理后台上传）"
fi

# ─── 完成 ────────────────────────────────────────────────────

echo ""
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED} ✗ 安装完成但有 $ERRORS 个错误${NC}"
  exit 1
fi

echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN} ✓ 安装完成！${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo "  启动服务："
echo -e "    ${CYAN}bash scripts/start-prod.sh${NC}          # 前台运行"
echo -e "    ${CYAN}bash scripts/start-prod.sh daemon${NC}    # PM2 后台运行"
echo ""
echo "  管理后台："
echo -e "    ${CYAN}http://<服务器IP>:3000/admin${NC}"
echo "  默认账号：admin / ffffff"
echo ""
