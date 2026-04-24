#!/usr/bin/env bash
#
# 紫微因果 - 一键启动脚本
# 用法: ./scripts/start.sh [dev|prod|stop|reset]
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

# ─── 检测 Node.js ───
ensure_node() {
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null

  if ! command -v node &>/dev/null; then
    err "未找到 Node.js，请先安装："
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    echo "  nvm install --lts"
    exit 1
  fi
  log "Node.js $(node -v)"
}

# ─── 检测 Docker ───
ensure_docker() {
  if ! command -v docker &>/dev/null; then
    err "未找到 Docker，请安装 Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    err "Docker 未运行！请先启动 Docker Desktop，然后重新运行此脚本。"
    exit 1
  fi
  log "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
}

# ─── 安装依赖 ───
install_deps() {
  if [ ! -d "node_modules" ]; then
    info "首次运行，安装 npm 依赖..."
    npm install
    log "npm 依赖安装完成"
  else
    log "npm 依赖已存在"
  fi
}

# ─── 初始化 .env ───
ensure_env() {
  if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
      cp .env.example .env
      warn "已从 .env.example 创建 .env，请编辑填入 AI 模型 API Key"
    else
      cat > .env << 'ENVEOF'
DATABASE_URL="mysql://navicause:navicause_pass_2024@localhost:3306/navicauseffect"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-change-in-production-abc123xyz"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
ZHIPU_API_KEY=""
ZHIPU_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
QWEN_API_KEY=""
QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
CLAUDE_API_KEY=""
CLAUDE_BASE_URL="https://api.anthropic.com"
ENVEOF
      warn "已创建默认 .env，请编辑填入 AI 模型 API Key"
    fi
  fi
  log ".env 配置就绪"
}

# ─── 启动基础设施（MySQL + Redis）───
start_infra() {
  info "启动 MySQL + Redis ..."
  docker compose up -d

  info "等待 MySQL 就绪（最多 60 秒）..."
  local retries=0
  while ! docker exec navicause_mysql mysqladmin ping -h localhost -u root -pnavicause_root_2024 --silent 2>/dev/null; do
    retries=$((retries + 1))
    if [ $retries -ge 30 ]; then
      err "MySQL 启动超时，请检查 Docker 日志: docker logs navicause_mysql"
      exit 1
    fi
    sleep 2
    printf "."
  done
  echo ""
  log "MySQL 已就绪"

  info "等待 Redis 就绪..."
  local retries=0
  while ! docker exec navicause_redis redis-cli ping 2>/dev/null | grep -q PONG; do
    retries=$((retries + 1))
    if [ $retries -ge 15 ]; then
      err "Redis 启动超时"
      exit 1
    fi
    sleep 1
  done
  log "Redis 已就绪"
}

# ─── 初始化数据库 ───
init_db() {
  info "同步数据库结构..."
  npx prisma db push --skip-generate 2>&1 | tail -5
  npx prisma generate
  log "数据库结构同步完成"
}

# ─── 注入默认 AI 模型配置 ───
seed_defaults() {
  info "检查默认数据..."
  node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.aIModelConfig.count();
  if (count > 0) { console.log('AI 模型配置已存在，跳过'); return; }

  const models = [
    { name: 'DeepSeek Chat', provider: 'deepseek', modelId: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', apiKeyEncrypted: process.env.DEEPSEEK_API_KEY || '', isActive: true, isDefault: true },
    { name: '智谱 GLM-4', provider: 'zhipu', modelId: 'glm-4-flash', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyEncrypted: process.env.ZHIPU_API_KEY || '', isActive: false, isDefault: false },
    { name: '通义千问', provider: 'qwen', modelId: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyEncrypted: process.env.QWEN_API_KEY || '', isActive: false, isDefault: false },
    { name: 'Claude', provider: 'claude', modelId: 'claude-sonnet-4-20250514', baseUrl: 'https://api.anthropic.com', apiKeyEncrypted: process.env.CLAUDE_API_KEY || '', isActive: false, isDefault: false },
  ];
  for (const m of models) { await prisma.aIModelConfig.create({ data: m }); }
  console.log('已创建 4 个默认 AI 模型配置');

  const pricingCount = await prisma.membershipPricing.count();
  if (pricingCount === 0) {
    await prisma.membershipPricing.createMany({ data: [
      { plan: 'MONTHLY', originalPrice: 10 },
      { plan: 'QUARTERLY', originalPrice: 25 },
      { plan: 'YEARLY', originalPrice: 99 },
    ]});
    console.log('已创建默认会员价格');
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
    console.log('已创建管理员账号: admin@navicause.com / admin123');
  }
}
main().catch(console.error).finally(() => prisma.\$disconnect());
" 2>&1
  log "默认数据就绪"
}

# ─── 停止所有服务 ───
stop_all() {
  info "停止所有服务..."

  # 停止 Next.js dev server
  local pids
  pids=$(lsof -ti:3000 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
    log "已停止端口 3000 上的进程"
  fi

  # 停止 Docker 容器
  if docker info &>/dev/null 2>&1; then
    docker compose down 2>/dev/null || true
    log "已停止 MySQL + Redis"
  fi

  log "所有服务已停止"
}

# ─── 完全重置 ───
reset_all() {
  warn "即将删除所有数据（数据库、Redis、node_modules）..."
  read -p "确认？(y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "已取消"
    exit 0
  fi

  stop_all

  if docker info &>/dev/null 2>&1; then
    docker compose down -v 2>/dev/null || true
    log "已删除 Docker volumes"
  fi

  rm -rf node_modules .next
  log "已清理 node_modules 和 .next 缓存"
  log "重置完成，运行 ./scripts/start.sh dev 重新开始"
}

# ─── 开发模式 ───
start_dev() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║      紫微因果 · 开发环境一键启动         ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""

  ensure_node
  ensure_docker
  ensure_env
  install_deps
  start_infra
  init_db
  seed_defaults

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN} 🎉 一切就绪！正在启动开发服务器...${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  前台首页:  ${CYAN}http://localhost:3000${NC}"
  echo -e "  排盘页面:  ${CYAN}http://localhost:3000/chart${NC}"
  echo -e "  管理后台:  ${CYAN}http://localhost:3000/admin${NC}"
  echo -e "  登录页面:  ${CYAN}http://localhost:3000/auth/login${NC}"
  echo ""
  echo -e "  管理员账号: ${YELLOW}admin@navicause.com${NC} / ${YELLOW}admin123${NC}"
  echo ""
  echo -e "  停止服务:  ${CYAN}./scripts/start.sh stop${NC}"
  echo ""

  exec npm run dev
}

# ─── 生产构建 ───
start_prod() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║      紫微因果 · 生产环境部署             ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""

  ensure_node
  ensure_docker
  ensure_env
  install_deps
  start_infra
  init_db
  seed_defaults

  info "构建生产版本..."
  npm run build
  log "构建完成"

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN} 🚀 生产环境启动中...${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  访问地址:  ${CYAN}http://localhost:3000${NC}"
  echo ""

  exec npm run start
}

# ─── 主入口 ───
case "${1:-dev}" in
  dev)   start_dev ;;
  prod)  start_prod ;;
  stop)  stop_all ;;
  reset) reset_all ;;
  *)
    echo "用法: $0 [dev|prod|stop|reset]"
    echo ""
    echo "  dev    开发模式（默认），热更新"
    echo "  prod   生产模式，先构建再启动"
    echo "  stop   停止所有服务"
    echo "  reset  完全重置（删除数据库和依赖）"
    exit 1
    ;;
esac
