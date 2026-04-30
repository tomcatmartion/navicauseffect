#!/usr/bin/env bash
#
# 紫微因果 - 腾讯云一键安装脚本（方案 C）
# 用法: ./scripts/install-deploy.sh [start|stop|restart|logs]
#
# 前提条件:
#   - Node.js 18+ 已安装
#   - MySQL 8.0 可连接（3306）
#   - Redis 可连接（6379）
#   - pnpm 已安装（如未安装，脚本自动安装）
#
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# ─── 颜色 ───
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

# ─── 环境变量默认配置 ───
DB_NAME="${DB_NAME:-navicauseffect}"
DB_USER="${DB_USER:-navicause}"
DB_PASS="${DB_PASS:-navicause_pass_2024}"
DB_HOST="${DB_HOST:-localhost}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
PORT="${PORT:-3000}"

# ─── Node.js ───
ensure_node() {
  if ! command -v node &>/dev/null; then
    err "未找到 Node.js，正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
  fi
  local ver
  ver=$(node -v | sed 's/v//')
  log "Node.js $(node -v)"

  local major
  major=$(echo "$ver" | cut -d. -f1)
  if [ "$major" -lt 18 ]; then
    err "Node.js 版本过低，需要 18+，当前 $(node -v)"
    exit 1
  fi
}

# ─── pnpm ───
ensure_pnpm() {
  if ! command -v pnpm &>/dev/null; then
    info "安装 pnpm..."
    curl -fsSL https://get.pnpm.io/install.sh | bash -
    export PNPM_HOME="$HOME/.local/share/pnpm"
    export PATH="$PNPM_HOME:$PATH"
  fi
  log "pnpm $(pnpm -v)"
}

# ─── pnpm store 配置 ───
configure_pnpm_store() {
  info "配置 pnpm 共享 store（所有项目共用）..."
  pnpm config set store-dir /opt/.pnpm-store
  log "store 目录: /opt/.pnpm-store"
}

# ─── MySQL 连接 ───
ensure_mysql() {
  if ! command -v mysql &>/dev/null; then
    err "未找到 mysql 命令，请先安装 MySQL 客户端："
    echo "  apt-get install mysql-client"
    exit 1
  fi

  info "检测 MySQL 连接（$DB_HOST）..."
  if mysql -h "$DB_HOST" -u root -p"${MYSQL_ROOT_PASSWORD:-}" -e "SELECT 1" &>/dev/null; then
    log "MySQL 连接成功"
    return 0
  fi

  if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" &>/dev/null; then
    log "MySQL 连接成功（使用应用账号）"
    return 0
  fi

  err "无法连接 MySQL，请检查 .env 中的 DATABASE_URL"
  exit 1
}

# ─── Redis 连接 ───
ensure_redis() {
  if command -v redis-cli &>/dev/null && redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
    log "Redis 连接成功"
    return 0
  fi

  warn "Redis 未连接，请确保 Redis 服务已启动"
  echo "  redis-cli -h $REDIS_HOST -p $REDIS_PORT ping"
}

# ─── .env 检测 ───
ensure_env() {
  if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
      cp .env.example .env
      warn "已从 .env.example 创建 .env，请编辑填入关键配置："
      echo "  vim .env"
    fi
  fi
  log ".env 就绪"
}

# ─── pnpm workspace 配置 ───
# 关键：pnpm 需要 workspace 配置才能正确解析 file:./packages/xxx 依赖
configure_workspace() {
  if [ ! -f "pnpm-workspace.yaml" ]; then
    info "创建 pnpm-workspace.yaml（支持 file: 本地包）..."
    cat > pnpm-workspace.yaml << 'YAMLEOF'
packages:
  - '.'
  - './packages/*'
YAMLEOF
    log "pnpm-workspace.yaml 创建完成"
  else
    log "pnpm-workspace.yaml 已存在"
  fi
}

# ─── 安装依赖 ───
do_install() {
  info "安装依赖（使用 pnpm，共用 store）..."
  pnpm install
  log "依赖安装完成"

  # pnpm 对本地 file: 包使用 hard-link，Next.js webpack 解析相对路径时有问题
  # 解决方案：将 .pnpm 中的硬链接目录替换为真实 symlink
  info "修复 pnpm hard-link 相对路径问题（iztro）..."
  local IZTRO_PNPM_DIR="$PROJECT_DIR/node_modules/.pnpm/iztro@file+packages+iztro/node_modules/iztro"
  if [ -d "$IZTRO_PNPM_DIR" ]; then
    rm -rf "$IZTRO_PNPM_DIR"
    mkdir -p "$(dirname "$IZTRO_PNPM_DIR")"
    ln -s "$PROJECT_DIR/packages/iztro" "$IZTRO_PNPM_DIR"
    log "iztro symlink 修复完成"
  fi

  local REACT_IZTRO_PNPM_DIR="$PROJECT_DIR/node_modules/.pnpm/react-iztro@file+packages+react-iztro/node_modules/react-iztro"
  if [ -d "$REACT_IZTRO_PNPM_DIR" ]; then
    rm -rf "$REACT_IZTRO_PNPM_DIR"
    mkdir -p "$(dirname "$REACT_IZTRO_PNPM_DIR")"
    ln -s "$PROJECT_DIR/packages/react-iztro" "$REACT_IZTRO_PNPM_DIR"
    log "react-iztro symlink 修复完成"
  fi
  log "pnpm hard-link 修复完成"
}

# ─── 生成 Prisma 客户端 ───
do_prisma_generate() {
  info "生成 Prisma 客户端（Linux 平台）..."
  npx prisma generate
  log "Prisma 客户端生成完成"
}

# ─── 构建 ───
do_build() {
  info "构建生产版本（Next.js standalone）..."
  npm run build
  log "构建完成"
}

# ─── 数据目录 ───
create_data_dirs() {
  info "创建数据目录..."
  mkdir -p data/zvec/sysknowledge_dim1536 data/zvec/sysknowledge_dim1024
  log "data/zvec/ 目录就绪"
}

# ─── 数据库初始化 ───
do_db_init() {
  info "同步数据库结构（prisma db push）..."
  npx prisma db push --skip-generate 2>&1 | tail -3
  log "数据库结构同步完成"

  info "写入默认数据..."
  node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const modelCount = await prisma.aIModelConfig.count();
  if (modelCount === 0) {
    const models = [
      { name: 'DeepSeek Chat', provider: 'deepseek', modelId: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', apiKeyEncrypted: '', isActive: true, isDefault: true },
      { name: '智谱 GLM-4', provider: 'zhipu', modelId: 'glm-4-flash', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEncrypted: '', isActive: false, isDefault: false },
      { name: '通义千问', provider: 'qwen', modelId: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEncrypted: '', isActive: false, isDefault: false },
      { name: 'Claude', provider: 'claude', modelId: 'claude-sonnet-4-20250514', baseUrl: 'https://api.anthropic.com', apiKeyEncrypted: '', isActive: false, isDefault: false },
    ];
    for (const m of models) await prisma.aIModelConfig.create({ data: m });
    console.log('  AI 模型配置已创建');
  } else {
    console.log('  AI 模型配置已存在，跳过');
  }

  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount === 0) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('ffffff', 12);
    await prisma.user.create({ data: {
      email: 'admin@navicause.com',
      password: hash,
      nickname: '管理员',
      role: 'ADMIN',
      inviteCode: 'ADMIN001',
      membership: { create: { plan: 'YEARLY', status: 'ACTIVE' } },
    }});
    console.log('  管理员账号已创建: admin@navicause.com / ffffff');
  } else {
    console.log('  管理员已存在，跳过');
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.\$disconnect());
" 2>&1
  log "默认数据就绪"
}

# ─── PM2 启动 ───
do_start() {
  info "启动服务（PM2）..."

  # 检查 PM2 是否已安装
  if ! command -v pm2 &>/dev/null; then
    info "安装 PM2..."
    pnpm add -g pm2
  fi

  # 如果已有进程，先停止
  if pm2 list 2>/dev/null | grep -q "navicauseffect"; then
    info "已有 navicauseffect 进程，重启..."
    pm2 stop navicauseffect 2>/dev/null || true
    pm2 delete navicauseffect 2>/dev/null || true
  fi

  # 读取 .env 文件中的变量（作为默认值补充）
  if [ -f ".env" ]; then
    set -a
    source .env
    set +a
  fi

  # 启动 standalone server（HOSTNAME=0.0.0.0 确保外网可访问）
  HOSTNAME=0.0.0.0 \
    PORT="$PORT" \
    NODE_ENV=production \
    DATABASE_URL="${DATABASE_URL:-mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:3306/${DB_NAME}}" \
    REDIS_URL="${REDIS_URL:-redis://${REDIS_HOST}:${REDIS_PORT}}" \
    NEXTAUTH_URL="${NEXTAUTH_URL:-http://119.45.168.110:${PORT}}" \
    NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-navicause-deploy-secret-change-me}" \
    pm2 start node --name "navicauseffect" -- .next/standalone/server.js

  info "保存 PM2 进程列表..."
  pm2 save 2>/dev/null || true

  # 等待服务启动
  sleep 3

  # 健康检查
  if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then
    log "服务启动成功！"
  else
    warn "服务可能尚未就绪，查看日志："
    echo "  ./scripts/install-deploy.sh logs"
  fi
}

do_stop() {
  info "停止 navicauseffect..."
  pm2 stop navicauseffect 2>/dev/null || true
  log "已停止"
}

do_restart() {
  do_stop
  do_start
}

do_logs() {
  pm2 logs navicauseffect --follow --lines 50
}

# ─── 完整安装流程 ───
do_install_all() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║   紫微因果 · 腾讯云一键安装（方案 C） ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""

  ensure_node
  ensure_pnpm
  configure_pnpm_store
  ensure_mysql
  ensure_redis
  ensure_env
  configure_workspace
  do_install
  do_prisma_generate
  create_data_dirs
  do_db_init
  do_build
  do_start

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN} 🎉 安装完成！${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  访问地址:  ${CYAN}http://119.45.168.110:${PORT}${NC}"
  echo -e "  管理后台:  ${CYAN}http://119.45.168.110:${PORT}/admin${NC}"
  echo ""
  echo -e "  常用命令:  ${CYAN}./scripts/install-deploy.sh logs${NC}"
  echo -e "  停止服务:  ${CYAN}./scripts/install-deploy.sh stop${NC}"
  echo -e "  重启服务:  ${CYAN}./scripts/install-deploy.sh restart${NC}"
  echo ""
}

# ─── 主入口 ───
case "${1:-install}" in
  install)  do_install_all ;;
  start)    do_start ;;
  stop)     do_stop ;;
  restart)  do_restart ;;
  logs)     do_logs ;;
  dbinit)   do_db_init ;;
  build)    do_build ;;
  *)
    echo "用法: $0 [install|start|stop|restart|logs|dbinit|build]"
    echo ""
    echo "  install  完整安装并启动（默认）"
    echo "  start   仅启动服务"
    echo "  stop    仅停止服务"
    echo "  restart 重启服务"
    echo "  logs    查看实时日志"
    echo "  dbinit  仅初始化数据库"
    echo "  build   仅重新构建"
    exit 1
    ;;
esac
