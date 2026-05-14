#!/bin/bash
# ──────────────────────────────────────────────────────────────
# 紫微心理 — 一键发布打包脚本
#
# 在 Mac 开发机上执行，生成可在任意 Linux 服务器部署的 tarball。
#
# 用法：
#   bash scripts/build-release.sh           # 构建 + 打包
#   bash scripts/build-release.sh --skip-build  # 跳过构建，仅打包
#
# 输出：dist/navicauseffect_v2-release.tar.gz
# ──────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

DIST_DIR="$PROJECT_DIR/dist"
STAGING="$DIST_DIR/staging/navicauseffect_v2"
ARCHIVE="$DIST_DIR/navicauseffect_v2-release.tar.gz"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     紫微心理 · 发布打包                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── 1. 构建 ──────────────────────────────────────────────────

if [ "${1:-}" != "--skip-build" ]; then
  echo "[1/5] 安装依赖（含 Linux 绑定）..."
  npm install --force @zvec/bindings-linux-x64@0.3.2 2>/dev/null || true

  echo "[2/5] 构建项目..."
  npm run build
  log "构建完成"
else
  warn "跳过构建（--skip-build）"
fi

# ─── 2. 验证关键文件 ──────────────────────────────────────────

echo "[3/5] 验证关键文件..."

STANDALONE="$PROJECT_DIR/.next/standalone"
[ -d "$STANDALONE" ] || err "standalone 输出不存在，请先执行 npm run build"

# Prisma Linux 引擎
PRISMA_ENGINE="$STANDALONE/node_modules/.prisma/client/libquery_engine-rhel-openssl-1.1.x.so.node"
[ -f "$PRISMA_ENGINE" ] || err "Prisma Linux 引擎不存在: $PRISMA_ENGINE"
log "Prisma rhel 引擎 OK"

# zvec Linux 绑定
ZVEC_BINDING="$STANDALONE/node_modules/@zvec/bindings-linux-x64/zvec_node_binding.node"
[ -f "$ZVEC_BINDING" ] || err "zvec linux-x64 绑定不存在: $ZVEC_BINDING"
log "zvec linux-x64 绑定 OK"

# ─── 3. 准备 staging 目录 ─────────────────────────────────────

echo "[4/5] 准备发布目录..."

rm -rf "$DIST_DIR/staging"
mkdir -p "$STAGING"

# standalone 输出（server.js + .next 内部文件）
cp -r "$STANDALONE/." "$STAGING/"

# 补全 standalone tracer 漏跟踪的依赖
# 策略：补全 package.json 直接依赖 + prisma 全家桶 + 子依赖
echo "  补全 node_modules（standalone tracer 漏跟踪的包）..."
for pkg in $(node -e "
const deps = require('./package.json').dependencies;
const fs = require('fs');
const pkgs = Object.keys(deps).filter(k => {
  if (deps[k].startsWith('file:')) return false;
  const standalonePath = './.next/standalone/node_modules/' + k;
  return !fs.existsSync(standalonePath);
});
console.log(pkgs.join('\n'));
"); do
  SRC="$PROJECT_DIR/node_modules/$pkg"
  DST="$STAGING/node_modules/$pkg"
  if [ -d "$SRC" ] && [ ! -d "$DST" ]; then
    mkdir -p "$DST"
    cp -r "$SRC/." "$DST/"
  fi
done

# 额外补全 prisma CLI 所需的间接依赖（standalone 只有 @prisma/client 运行时）
for pkg in prisma @prisma/engines @prisma/internals @prisma/config @prisma/migrate @prisma/generator-helper @prisma/get-platform @prisma/engines-version; do
  SRC="$PROJECT_DIR/node_modules/$pkg"
  DST="$STAGING/node_modules/$pkg"
  if [ -d "$SRC" ] && [ ! -d "$DST" ]; then
    mkdir -p "$DST"
    cp -r "$SRC/." "$DST/"
  fi
done
# .bin/prisma 符号链接
if [ -e "$PROJECT_DIR/node_modules/.bin/prisma" ] && [ ! -e "$STAGING/node_modules/.bin/prisma" ]; then
  mkdir -p "$STAGING/node_modules/.bin"
  cp "$PROJECT_DIR/node_modules/.bin/prisma" "$STAGING/node_modules/.bin/prisma"
fi
log "node_modules 补全完成"

# .next/static（standalone 不含，Next.js 运行时需要）
mkdir -p "$STAGING/.next/static"
cp -r "$PROJECT_DIR/.next/static/." "$STAGING/.next/static/"

# prisma（schema + migrations + CLI，服务器端 migrate deploy 需要）
mkdir -p "$STAGING/prisma"
cp -r "$PROJECT_DIR/prisma/." "$STAGING/prisma/"
# standalone 不含 prisma CLI，从源项目 node_modules 拷入
mkdir -p "$STAGING/node_modules/prisma"
cp -r "$PROJECT_DIR/node_modules/prisma/." "$STAGING/node_modules/prisma/"
mkdir -p "$STAGING/node_modules/.bin"
cp "$PROJECT_DIR/node_modules/.bin/prisma" "$STAGING/node_modules/.bin/prisma" 2>/dev/null || true

# public（字体、图标等）
cp -r "$PROJECT_DIR/public" "$STAGING/public"

# sysfiles（知识库 + 标签定义，standalone 可能已有，覆盖确保最新）
rm -rf "$STAGING/sysfiles"
cp -r "$PROJECT_DIR/sysfiles" "$STAGING/sysfiles"

# 脚本
mkdir -p "$STAGING/scripts"
cp "$PROJECT_DIR/scripts/start-prod.sh" "$STAGING/scripts/"
cp "$PROJECT_DIR/scripts/install.sh" "$STAGING/scripts/" 2>/dev/null || warn "install.sh 尚未创建"
cp "$PROJECT_DIR/scripts/seed-ai-models.js" "$STAGING/scripts/" 2>/dev/null || true

# 编译 TS 运维脚本为独立 JS（生产环境不需要 tsx）
echo "  编译运维脚本为独立 JS..."
for script in logicdoc-index-zvec index-ziwei-knowledge; do
  SRC="$PROJECT_DIR/scripts/${script}.ts"
  if [ -f "$SRC" ]; then
    npx esbuild "$SRC" \
      --bundle --platform=node --format=cjs \
      --external:@prisma/client \
      --external:@prisma/engines \
      --external:@zvec/zvec \
      --external:@zvec/bindings-linux-x64 \
      --external:@zvec/bindings-darwin-arm64 \
      --external:dotenv \
      --outfile="$STAGING/scripts/${script}.cjs" \
      --sourcemap=inline
    log "  已编译: ${script}.ts → ${script}.cjs"
  fi
done

# 环境变量模板
cp "$PROJECT_DIR/.env.example" "$STAGING/.env.example"

# package.json（仅用于 prisma CLI）
cp "$PROJECT_DIR/package.json" "$STAGING/package.json"
cp "$PROJECT_DIR/package-lock.json" "$STAGING/package-lock.json" 2>/dev/null || true

# 清理 macOS 垃圾文件
find "$STAGING" -name ".DS_Store" -delete
find "$STAGING" -name "*.broken" -type d -exec rm -rf {} + 2>/dev/null || true

# 删除 darwin 绑定（减小体积，服务器不需要）
rm -rf "$STAGING/node_modules/@zvec/bindings-darwin-arm64" 2>/dev/null || true
# 删除 darwin 的 prisma 引擎（减小 ~19MB）
rm -f "$STAGING/node_modules/.prisma/client/libquery_engine-darwin-arm64.dylib.node" 2>/dev/null || true

log "staging 目录准备完成"

# ─── 4. 打包 ──────────────────────────────────────────────────

echo "[5/5] 打包 tarball..."

mkdir -p "$DIST_DIR"
rm -f "$ARCHIVE"

# 从 staging 的父目录打包，这样解压后得到 navicauseffect_v2/ 目录
cd "$DIST_DIR/staging"
# COPYFILE_DISABLE: 排除 macOS ._ 资源分叉文件
# --no-xattrs: 不写入 macOS 扩展属性（quarantine/provenance 等，Linux tar 会报警告）
COPYFILE_DISABLE=1 tar czf "$ARCHIVE" \
  --no-xattrs \
  --no-recursion \
  -T <(find navicauseffect_v2 -type f -o -type l | grep -v '.DS_Store')
cd "$PROJECT_DIR"

SIZE=$(du -h "$ARCHIVE" | cut -f1)

echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN} ✓ 发布包已生成${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  文件: ${ARCHIVE}"
echo -e "  大小: ${SIZE}"
echo ""
echo "  上传到服务器："
echo "    scp $ARCHIVE user@server:/opt/"
echo ""
echo "  服务器上执行："
echo "    cd /opt && tar xzf navicauseffect_v2-release.tar.gz"
echo "    cd navicauseffect_v2 && bash scripts/install.sh"
echo ""

# 清理 staging
rm -rf "$DIST_DIR/staging"
