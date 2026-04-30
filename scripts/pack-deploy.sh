#!/usr/bin/env bash
#
# 紫微因果 - 一键打包脚本（macOS → 腾讯云部署包）
# 用法: ./scripts/pack-deploy.sh
#
# 排除内容:
#   - node_modules（服务器重新安装）
#   - .next（服务器重新构建）
#   - packages/*/node_modules（darwin 二进制，上传后无法在 Linux 运行）
#   - .git（不需要）
#   - 文档和配置文件（不需要）
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

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
DEPLOY_DIR="/tmp/navicauseffect-deploy"
ARCHIVE_NAME="navicauseffect-${TIMESTAMP}.tar.gz"

# ─── 清理残留 ───
cleanup() {
  if [ -d "$DEPLOY_DIR" ]; then
    rm -rf "$DEPLOY_DIR"
  fi
}
trap cleanup EXIT

# ─── 打包函数 ───
do_pack() {
  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║     紫微因果 · 一键打包（方案 C）     ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""

  # 1. 创建临时打包目录
  info "创建打包目录..."
  mkdir -p "$DEPLOY_DIR"
  log "打包目录: $DEPLOY_DIR"

  # 2. rsync 同步（精确排除）
  # 关键：packages/*/node_modules 不上传（darwin 二进制无法在 Linux 运行）
  # 关键：rsync 自动跳过 packages/*/node_modules 目录
  info "同步文件（排除 node_modules / .next / darwin 二进制）..."
  rsync -av \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='packages/*/node_modules' \
    --exclude='packages/iztro/node_modules' \
    --exclude='packages/react-iztro/node_modules' \
    --exclude='packages/iztro/dist' \
    --exclude='packages/react-iztro/dist' \
    --exclude='packages/*/.DS_Store' \
    --exclude='packages/iztro/docs' \
    --exclude='packages/react-iztro/docs' \
    --exclude='packages/iztro/types' \
    --exclude='packages/react-iztro/types' \
    --exclude='*.md' \
    --exclude='planfiles/' \
    --exclude='.claude*' \
    --exclude='.cursor*' \
    --exclude='.gstack*' \
    --exclude='coverage/' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*.local' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --exclude='docker-compose.yml' \
    --exclude='docker-compose.prod.yml' \
    --exclude='Dockerfile' \
    --exclude='.dockerignore' \
    --exclude='docker/' \
    --exclude='dist/' \
    --exclude='./data/' \
    --exclude='.gitignore' \
    --exclude='.prettierrc*' \
    --exclude='.eslintrc*' \
    --exclude='.vscode/' \
    --exclude='*.test.ts' \
    --exclude='*.spec.ts' \
    --exclude='__tests__/' \
    --exclude='.turbo/' \
    "$PROJECT_DIR/" "$DEPLOY_DIR/"

  # 3. 打包（消除 macOS xattr 扩展属性，避免 Linux 解压警告）
  # 优先用 gtar（GNU tar），其次用系统 tar（bsdtar 或 GNU tar）
  info "打包 tar.gz（消除 macOS xattr）..."
  local tar_cmd
  if command -v gtar &>/dev/null; then
    tar_cmd="gtar"
  elif tar --version 2>&1 | grep -q 'GNU'; then
    tar_cmd="tar"
  else
    tar_cmd="tar"
  fi

  if [ "$tar_cmd" = "gtar" ] || tar --version 2>&1 | grep -q 'GNU'; then
    # GNU tar：--no-xattrs 消除所有 xattr，--format=gnu 确保 Linux 兼容
    COPYFILE_DISABLE=1 $tar_cmd --no-xattrs --format=gnu \
      -czf "$ARCHIVE_NAME" \
      -C "$(dirname "$DEPLOY_DIR")" \
      "$(basename "$DEPLOY_DIR")"
  else
    # bsdtar（macOS）：COPYFILE_DISABLE=1 消除 resource fork，ustar 格式跨平台兼容
    COPYFILE_DISABLE=1 $tar_cmd --no-xattrs --format=ustar \
      -czf "$ARCHIVE_NAME" \
      -C "$(dirname "$DEPLOY_DIR")" \
      "$(basename "$DEPLOY_DIR")" 2>/dev/null || \
    COPYFILE_DISABLE=1 $tar_cmd \
      -czf "$ARCHIVE_NAME" \
      -C "$(dirname "$DEPLOY_DIR")" \
      "$(basename "$DEPLOY_DIR")"
  fi

  # 4. 统计
  local size lines
  size=$(du -sh "$ARCHIVE_NAME" | cut -f1)
  lines=$(tar tzf "$ARCHIVE_NAME" | wc -l | tr -d ' ')

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo -e "${GREEN} 🎉 打包完成！${NC}"
  echo -e "${GREEN}══════════════════════════════════════════${NC}"
  echo ""
  echo -e "  归档文件:  ${CYAN}${ARCHIVE_NAME}${NC}"
  echo -e "  归档大小:  ${CYAN}${size}${NC}"
  echo -e "  文件数量:  ${CYAN}${lines} 个${NC}"
  echo ""
  echo -e "${YELLOW}下一步：上传到腾讯云${NC}"
  echo ""
  echo -e "  方式 A - rsync（推荐，不解压）："
  echo -e "  ${CYAN}rsync -av --delete /tmp/navicauseffect-deploy/ \\${NC}"
  echo -e "  ${CYAN}    user@119.45.168.110:/opt/navicauseffect/${NC}"
  echo ""
  echo -e "  方式 B - scp + 服务器解压："
  echo -e "  ${CYAN}scp ${ARCHIVE_NAME} user@119.45.168.110:/opt/${NC}"
  echo -e "  ${CYAN}ssh user@119.45.168.110 'cd /opt && tar xzf navicauseffect-${TIMESTAMP}.tar.gz'${NC}"
  echo ""
}

# ─── 交互确认 ───
echo ""
read -p "确认打包？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消"
  exit 0
fi

do_pack
