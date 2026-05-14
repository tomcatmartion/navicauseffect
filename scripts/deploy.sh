#!/usr/bin/env bash
#
# 紫微因果 - Docker 全容器化一键部署
# 用法: ./scripts/deploy.sh [up|down|logs|rebuild]
#
# 适合服务器部署，只需要 Docker，不需要 Node.js
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

COMPOSE_FILE="docker-compose.prod.yml"

ensure_docker() {
  if ! command -v docker &>/dev/null; then
    err "未找到 Docker。"
    echo "  CentOS/RHEL:  curl -fsSL https://get.docker.com | sh"
    echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh"
    echo "  macOS:         https://www.docker.com/products/docker-desktop/"
    exit 1
  fi
  if ! docker info &>/dev/null 2>&1; then
    err "Docker 未运行！"
    exit 1
  fi
  log "Docker OK"
}

ensure_env() {
  if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
      cp .env.example .env
    else
      cat > .env << 'ENVEOF'
MYSQL_ROOT_PASSWORD=navicause_root_2024
MYSQL_PASSWORD=navicause_pass_2024
DATABASE_URL="mysql://navicause:navicause_pass_2024@mysql:3306/navicauseffect_v2"
REDIS_URL="redis://redis:6379"
NEXTAUTH_URL="http://localhost:3333"
NEXTAUTH_SECRET="generate-a-strong-secret-here"
ENVEOF
    fi
    warn "已创建 .env 文件，请编辑后重新运行："
    echo "  vim .env"
    echo "  ./scripts/deploy.sh up"
    exit 0
  fi
  log ".env 就绪"
}

deploy_up() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║     紫微因果 · Docker 全容器化部署       ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""

  ensure_docker
  ensure_env

  info "构建并启动所有容器..."
  docker compose -f "$COMPOSE_FILE" up -d --build

  info "等待服务就绪..."
  sleep 5

  # 同步数据库
  info "同步数据库结构..."
  docker exec navicause_app sh -c "npx prisma db push --skip-generate" 2>&1 || warn "数据库同步需要等待 MySQL 完全启动后手动执行"

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN} 🎉 部署完成！${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  访问地址:    ${CYAN}http://localhost:3333${NC}"
  echo -e "  管理后台:    ${CYAN}http://localhost:3333/admin${NC}"
  echo ""
  echo -e "  查看日志:    ${CYAN}./scripts/deploy.sh logs${NC}"
  echo -e "  停止服务:    ${CYAN}./scripts/deploy.sh down${NC}"
  echo -e "  重新构建:    ${CYAN}./scripts/deploy.sh rebuild${NC}"
  echo ""
}

deploy_down() {
  info "停止所有容器..."
  docker compose -f "$COMPOSE_FILE" down
  log "已停止"
}

deploy_logs() {
  docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

deploy_rebuild() {
  info "重新构建并部署..."
  docker compose -f "$COMPOSE_FILE" down
  docker compose -f "$COMPOSE_FILE" up -d --build --force-recreate
  log "重建完成"
}

case "${1:-up}" in
  up)      deploy_up ;;
  down)    deploy_down ;;
  logs)    deploy_logs ;;
  rebuild) deploy_rebuild ;;
  *)
    echo "用法: $0 [up|down|logs|rebuild]"
    echo ""
    echo "  up       构建并启动所有容器（默认）"
    echo "  down     停止所有容器"
    echo "  logs     查看实时日志"
    echo "  rebuild  重新构建并启动"
    exit 1
    ;;
esac
