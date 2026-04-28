#!/bin/bash
# 构建后脚本：将 Linux 平台的 zvec 原生绑定拷贝进 standalone 输出
#
# 背景：@zvec/zvec 通过动态 require("@zvec/bindings-${platform}-${arch}")
# 加载 .node 二进制，Next.js 的 file tracer 无法静态跟踪。
# macOS 上构建时只有 darwin-arm64 绑定，Linux 服务器运行时需要 linux-x64。
#
# 用法：在 next build 之后、部署之前执行
#   npm run build && bash scripts/postbuild-copy-zvec-bindings.sh

set -e

STANDALONE=".next/standalone"
SRC="node_modules/@zvec/bindings-linux-x64"
DST="$STANDALONE/node_modules/@zvec/bindings-linux-x64"

if [ ! -d "$STANDALONE" ]; then
  echo "错误：未找到 standalone 输出 ($STANDALONE)，请先执行 next build"
  exit 1
fi

if [ ! -f "$SRC/zvec_node_binding.node" ]; then
  echo "错误：未找到 linux-x64 绑定，请先执行 npm install @zvec/bindings-linux-x64 --force"
  exit 1
fi

# 拷贝整个绑定包到 standalone 的 node_modules
mkdir -p "$DST"
cp "$SRC/package.json" "$DST/"
cp "$SRC/zvec_node_binding.node" "$DST/"

echo "✓ 已拷贝 @zvec/bindings-linux-x64 → standalone 输出"
