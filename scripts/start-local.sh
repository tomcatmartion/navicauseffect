#!/usr/bin/env bash
#
# 紫微因果 - 本地一键启动（无需 Docker）
# 用法: ./scripts/start-local.sh [dev|stop|reset]
#
# MySQL 和 Redis 支持任意安装方式（Homebrew / 官方安装包 / 手动编译均可）
# 脚本通过端口连通性检测服务状态，不依赖特定安装方式
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; }
info() { echo -e "${CYAN}[i]${NC} $*"; }

DB_NAME="navicauseffect_v2"
DB_USER="navicause"
DB_PASS="navicause_pass_2024"

# 从 .env 读取 MySQL root 密码
if [ -f "$PROJECT_DIR/.env" ]; then
  MYSQL_ROOT_PASSWORD=$(grep -E '^MYSQL_ROOT_PASSWORD=' "$PROJECT_DIR/.env" 2>/dev/null | sed 's/^MYSQL_ROOT_PASSWORD=//' | tr -d '"' | tr -d "'" || true)
fi
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"

# ─── Node.js ───
ensure_node() {
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null

  if ! command -v node &>/dev/null; then
    err "未找到 Node.js，请先安装："
    echo "  方式1: brew install node"
    echo "  方式2: https://nodejs.org 下载安装"
    echo "  方式3: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash && nvm install --lts"
    exit 1
  fi
  log "Node.js $(node -v)"
}

# ─── MySQL：只检测是否能连上，不管怎么装的 ───
ensure_mysql() {
  if ! command -v mysql &>/dev/null; then
    err "未找到 mysql 命令。请确认 MySQL 已安装且 mysql 在 PATH 中。"
    echo "  如果已安装但命令找不到，可尝试添加到 PATH："
    echo "  export PATH=/usr/local/mysql/bin:\$PATH"
    exit 1
  fi

  # 按优先级尝试连接：.env 密码 → 无密码 → socket
  if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
    if mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1" &>/dev/null 2>&1; then
      MYSQL_ROOT_CMD="mysql -u root -p$MYSQL_ROOT_PASSWORD"
      log "MySQL 连接正常（使用 .env 中的 root 密码）"
      return 0
    else
      err ".env 中的 MYSQL_ROOT_PASSWORD 无法连接 MySQL，请检查密码是否正确"
      exit 1
    fi
  fi

  if mysql -u root -e "SELECT 1" &>/dev/null 2>&1; then
    MYSQL_ROOT_CMD="mysql -u root"
    log "MySQL 连接正常（root 无密码）"
    return 0
  fi

  # 尝试通过 socket 连接
  local sock=""
  for s in /tmp/mysql.sock /var/run/mysqld/mysqld.sock /usr/local/mysql/data/mysql.sock; do
    [ -S "$s" ] && sock="$s" && break
  done
  if [ -n "$sock" ] && mysql -u root -S "$sock" -e "SELECT 1" &>/dev/null 2>&1; then
    MYSQL_ROOT_CMD="mysql -u root -S $sock"
    log "MySQL 连接正常（通过 socket）"
    return 0
  fi

  err "无法连接 MySQL！"
  echo ""
  echo "  请在 .env 文件中设置你的 MySQL root 密码："
  echo "  MYSQL_ROOT_PASSWORD=\"你的root密码\""
  echo ""
  echo "  或确认 MySQL 服务已启动："
  echo "    macOS 官方安装包:  sudo /usr/local/mysql/support-files/mysql.server start"
  echo "    Homebrew:          brew services start mysql"
  echo "    Linux:             sudo systemctl start mysql"
  exit 1
}

setup_database() {
  info "配置数据库 ${DB_NAME} ..."

  ${MYSQL_ROOT_CMD} -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
  ${MYSQL_ROOT_CMD} -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
  ${MYSQL_ROOT_CMD} -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" 2>/dev/null || true
  ${MYSQL_ROOT_CMD} -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';" 2>/dev/null
  ${MYSQL_ROOT_CMD} -e "FLUSH PRIVILEGES;" 2>/dev/null

  if mysql -u "${DB_USER}" -p"${DB_PASS}" -e "USE ${DB_NAME}; SELECT 1;" &>/dev/null 2>&1; then
    log "数据库 ${DB_NAME} 就绪 (用户: ${DB_USER})"
  else
    err "数据库用户创建失败，请手动执行："
    echo "  $MYSQL_ROOT_CMD"
    echo "  CREATE DATABASE IF NOT EXISTS navicauseffect_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo "  CREATE USER 'navicause'@'localhost' IDENTIFIED BY 'navicause_pass_2024';"
    echo "  GRANT ALL PRIVILEGES ON navicauseffect_v2.* TO 'navicause'@'localhost';"
    echo "  FLUSH PRIVILEGES;"
    exit 1
  fi
}

# ─── Redis：检测是否能 PING 通 ───
ensure_redis() {
  if command -v redis-cli &>/dev/null && redis-cli ping 2>/dev/null | grep -q PONG; then
    log "Redis 连接正常"
    return 0
  fi

  warn "Redis 未运行或未安装，尝试自动处理..."

  if command -v redis-server &>/dev/null; then
    # redis-server 命令存在但服务没跑，尝试启动
    if command -v brew &>/dev/null && brew list redis &>/dev/null 2>&1; then
      brew services start redis
    else
      info "后台启动 redis-server..."
      redis-server --daemonize yes 2>/dev/null || true
    fi
    sleep 2
    if redis-cli ping 2>/dev/null | grep -q PONG; then
      log "Redis 已启动"
      return 0
    fi
  fi

  # 还是不行，尝试安装
  if command -v brew &>/dev/null; then
    info "通过 Homebrew 安装 Redis..."
    brew install redis
    brew services start redis
    sleep 2
    if redis-cli ping 2>/dev/null | grep -q PONG; then
      log "Redis 已安装并启动"
      return 0
    fi
  fi

  err "Redis 不可用！请手动安装并启动："
  echo "  macOS:  brew install redis && brew services start redis"
  echo "  Linux:  sudo apt install redis-server && sudo systemctl start redis"
  exit 1
}

# ─── npm 依赖 ───
install_deps() {
  if [ ! -d "node_modules" ]; then
    info "安装 npm 依赖（首次需要 1-2 分钟）..."
    npm install
    log "依赖安装完成"
  else
    log "npm 依赖已存在"
  fi
}

# ─── .env ───
ensure_env() {
  if [ ! -f ".env" ]; then
    cat > .env << ENVEOF
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3333"
NEXTAUTH_SECRET="dev-secret-change-in-production-abc123xyz"
ENVEOF
    warn "已创建 .env；大模型请在管理后台「AI 模型」配置（仅存数据库）"
  fi
  log ".env 就绪"
}

# ─── 同步数据库表 ───
sync_db() {
  info "同步数据库表结构..."
  npx prisma db push --skip-generate 2>&1 | tail -3
  npx prisma generate 2>&1 | tail -2
  log "数据库表结构同步完成"
}

# ─── 写入默认数据 ───
seed_data() {
  info "写入默认数据..."
  node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const modelCount = await prisma.aIModelConfig.count();
  if (modelCount === 0) {
    console.log('  无 AI 模型记录：请在管理后台 /admin/models 添加并填写密钥');
  } else {
    console.log('  AI 模型配置已存在，跳过');
  }

  const pricingCount = await prisma.membershipPricing.count();
  if (pricingCount === 0) {
    await prisma.membershipPricing.createMany({ data: [
      { plan: 'MONTHLY', originalPrice: 10 },
      { plan: 'QUARTERLY', originalPrice: 25 },
      { plan: 'YEARLY', originalPrice: 99 },
    ]});
    console.log('  已创建会员价格');
  }

  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount === 0) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123', 12);
    await prisma.user.create({ data: {
      email: 'admin@navicause.com',
      password: hash,
      nickname: '管理员',
      role: 'ADMIN',
      inviteCode: 'ADMIN001',
      membership: { create: { plan: 'YEARLY', status: 'ACTIVE' } },
    }});
    console.log('  已创建管理员: admin@navicause.com / admin123');
  }
}
main().catch(e => console.error(e)).finally(() => prisma.\$disconnect());
" 2>&1
  log "默认数据就绪"
}

# ─── 停止 ───
stop_all() {
  info "停止 Next.js 开发服务器..."
  local pids
  pids=$(DB_NAME="navicauseffect_v2" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    log "已停止"
  else
    info "端口 3333 上没有运行中的进程"
  fi
  log "完成（MySQL 和 Redis 保持运行，不影响其他程序）"
}

# ─── 重置 ───
reset_all() {
  warn "即将删除数据库 ${DB_NAME} 和 node_modules..."
  read -p "确认？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "已取消"
    exit 0
  fi

  stop_all

  if command -v mysql &>/dev/null; then
    mysql -u root -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" 2>/dev/null || \
    mysql -u root -p -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" 2>/dev/null || \
    warn "无法自动删除数据库，请手动: mysql -u root -e 'DROP DATABASE navicauseffect_v2;'"
  fi

  rm -rf node_modules .next
  log "已清理 node_modules 和 .next"
  log "重置完成，运行 ./scripts/start-local.sh 重新开始"
}

# ─── 开发模式 ───
start_dev() {
  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║   紫微因果 · 本地一键启动（无需 Docker）   ║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
  echo ""

  ensure_node
  ensure_mysql
  setup_database
  ensure_redis
  ensure_env
  install_deps
  sync_db
  seed_data

  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════${NC}"
  echo -e "${GREEN}  一切就绪！启动开发服务器...${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  首页:      ${CYAN}http://localhost:3333${NC}"
  echo -e "  排盘:      ${CYAN}http://localhost:3333/chart${NC}"
  echo -e "  管理后台:  ${CYAN}http://localhost:3333/admin${NC}"
  echo -e "  登录:      ${CYAN}http://localhost:3333/auth/login${NC}"
  echo ""
  echo -e "  管理员:    ${YELLOW}admin@navicause.com${NC} / ${YELLOW}admin123${NC}"
  echo ""
  echo -e "  停止: ${CYAN}./scripts/start-local.sh stop${NC}  或  ${CYAN}Ctrl+C${NC}"
  echo ""

  exec npm run dev
}

case "${1:-dev}" in
  dev)   start_dev ;;
  stop)  stop_all ;;
  reset) reset_all ;;
  *)
    echo "用法: $0 [dev|stop|reset]"
    echo ""
    echo "  dev    启动开发环境（默认）"
    echo "  stop   停止 Next.js 服务器"
    echo "  reset  删除数据库和依赖，从头来过"
    exit 1
    ;;
esac
