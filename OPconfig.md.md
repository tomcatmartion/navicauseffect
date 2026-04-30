# 部署指南（方案 C：macOS 打包 → 服务器构建）

> 本方案适用于 navicauseffect（紫微心理）项目的腾讯云部署。
> 核心思路：macOS 只打包源码（~11MB），服务器负责 npm install + Next.js build，彻底避免 darwin 二进制污染 Linux 环境。

---

## 目录

1. [环境要求](#一环境要求)
2. [完整部署流程](#二完整部署流程)
3. [各步骤详解](#三各步骤详解)
4. [常见问题与处理](#四常见问题与处理)
5. [目录结构说明](#五目录结构说明)

---

## 一、环境要求

### 开发机（macOS）

- Node.js 18+（用于执行打包脚本）
- rsync / scp（用于上传）

### 服务器（腾讯云）

- Node.js 20+（腾讯云已装 v20）
- MySQL 8.0+（必须已运行，3306 端口）
- Redis（必须已运行，6379 端口）
- 磁盘空间：建议 20GB+

### SSH 连接

```bash
# root 账号（有 sudo 权限，可写入 /opt）
ssh root@119.45.168.110
# 密码：FDsa1234!@#$
```

---

## 二、完整部署流程

### 步骤 1：打包（macOS 本地）

```bash
cd /Users/martin/dev/navicauseffect
./scripts/pack-deploy.sh
```

输出：`navicauseffect-YYYYMMDD-HHMMSS.tar.gz`（约 11MB）

### 步骤 2：上传到腾讯云

```bash
# 方式 A：rsync（推荐，不解压，增量同步）
rsync -av --delete /tmp/navicauseffect-deploy/ \
    root@119.45.168.110:/opt/navicauseffect/

# 方式 B：scp + 服务器解压
scp navicauseffect-YYYYMMDD-HHMMSS.tar.gz root@119.45.168.110:/tmp/
ssh root@119.45.168.110
  cd /opt/navicauseffect
  tar xzf /tmp/navicauseffect-YYYYMMDD-HHMMSS.tar.gz
```

### 步骤 3：安装部署（腾讯云）

```bash
cd /opt/navicauseffect

# 首次部署（完整流程）
./scripts/install-deploy.sh install

# 后续更新（代码变更后，只重新构建 + 启动，跳过 dbinit）
./scripts/install-deploy.sh build && ./scripts/install-deploy.sh start

# 常用操作
./scripts/install-deploy.sh stop      # 停止服务
./scripts/install-deploy.sh restart  # 重启服务
./scripts/install-deploy.sh logs     # 查看日志
./scripts/install-deploy.sh dbinit  # 重新初始化数据库
```

---

## 三、各步骤详解

### 3.1 打包脚本 `pack-deploy.sh`

**功能**：将源码打包，排除所有不需要的文件

**排除的内容**：

| 排除项 | 原因 |
|--------|------|
| `node_modules/` | darwin 二进制，无法在 Linux 运行 |
| `.next/` | 服务器重新构建 |
| `packages/*/node_modules/` | darwin 二进制 |
| `data/` | 服务器运行时生成 |
| `dist/` | 历史遗留，无需上传 |
| `*.md` | 文档不需上传 |
| `docker-compose.yml` | 方案 C 不使用 Docker |

**验证打包结果**：
```bash
# 检查关键文件是否包含
tar -tzf navicauseffect-*.tar.gz | grep -E "package.json|postbuild|packages/iztro" | head

# 检查是否包含不应上传的文件（应无输出）
tar -tzf navicauseffect-*.tar.gz | grep -E "node_modules|\.next" | head
```

### 3.2 安装脚本 `install-deploy.sh`

**`install` 子命令完整流程**：

```
1. 检查 Node.js（>= v18）
2. 安装 pnpm（通过 npm）
3. 配置 pnpm 共享 store（/opt/.pnpm-store，多项目共用）
4. 检测 MySQL 连接
5. 检测 Redis 连接
6. 创建/更新 .env
7. 创建 pnpm-workspace.yaml（支持本地 file: 包）
8. npm install（服务器上重新安装 Linux 二进制）
9. 修复 pnpm hard-link 问题（iztro / react-iztro symlink）
10. npx prisma generate（生成 Linux Prisma 引擎）
11. mkdir -p data/zvec/（创建数据目录）
12. npm run build（Next.js build）
    → 自动执行 postbuild-copy-zvec-bindings.sh
    → 复制 @zvec/bindings-linux-x64 到 standalone
    → 复制 .next/static 到 standalone/.next/
13. 启动服务
```

**`build` 子命令**：
```bash
npm run build   # 重新构建（代码变更后执行）
```

**`start` 子命令**：
```bash
# 停止现有进程 → 读取 .env → nohup 启动 standalone server
pkill -f "node.*standalone" && fuser -k ${PORT}/tcp
nohup env HOSTNAME=0.0.0.0 PORT=3000 NODE_ENV=production ... \
    node .next/standalone/server.js > /tmp/navicause-server.log &
```

### 3.3 构建后脚本 `postbuild-copy-zvec-bindings.sh`

**自动在 `npm run build` 后执行**，完成两个关键任务：

1. **复制 zvec Linux 绑定**
   ```
   node_modules/@zvec/bindings-linux-x64/zvec_node_binding.node
   → .next/standalone/node_modules/@zvec/bindings-linux-x64/
   ```

2. **复制静态文件**
   ```
   .next/static/
   → .next/standalone/.next/static/
   ```

> 注意：这是必须的步骤，因为 Next.js standalone 模式本身不会自动把 static 文件放到独立可用的位置。

---

## 四、常见问题与处理

### 4.1 服务启动后 CSS/JS 返回 404

**原因**：`postbuild-copy-zvec-bindings.sh` 没有正确执行，或 `.next/static` 没有被复制进 standalone。

**排查**：
```bash
# 检查 static 目录是否存在
ls /opt/navicauseffect/.next/standalone/.next/static/css/

# 检查页面引用的 CSS 文件是否存在
curl -s http://localhost:3000/ | grep -o 'href="/_next/static/css/[^"]*"'
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/_next/static/css/文件hash.css"
```

**解决**：在服务器上重新 build
```bash
cd /opt/navicauseffect
npm run build
./scripts/install-deploy.sh start
```

---

### 4.2 端口被占用

**原因**：上一个进程没有完全退出。

**排查**：
```bash
lsof -i :3000
ps aux | grep node
```

**解决**：
```bash
pkill -9 node
fuser -k 3000/tcp
./scripts/install-deploy.sh start
```

---

### 4.3 数据库连接失败

**原因**：`.env` 中 `DATABASE_URL` 配置错误，或 MySQL 未运行。

**排查**：
```bash
mysql -u navicause -p -h localhost navicauseffect -e "SELECT 1"
```

**解决**：检查 `/opt/navicauseffect/.env` 中的 `DATABASE_URL` 是否正确。

---

### 4.4 pnpm install 失败

**原因**：腾讯云无法访问外网（get.pnpm.io / GitHub）。

**解决**：`install-deploy.sh` 已内置 npm 安装 pnpm 的 fallback，通常自动处理。如果仍失败：
```bash
npm install -g pnpm
```

---

## 五、目录结构说明

### 部署后服务器目录结构

```
/opt/navicauseffect/
├── .next/
│   └── standalone/          # Next.js standalone 输出（核心运行时）
│       ├── server.js       # 启动入口
│       ├── .next/
│       │   └── static/    # 静态文件（CSS/JS/字体）
│       ├── node_modules/    # Linux 二进制（@prisma, @zvec）
│       └── packages/        # 本地包（iztro, react-iztro）
├── scripts/
│   ├── pack-deploy.sh         # 打包脚本（macOS 用）
│   ├── install-deploy.sh       # 安装部署脚本（服务器用）
│   └── postbuild-copy-zvec-bindings.sh   # build 后处理（自动执行）
├── prisma/                 # 数据库 schema
├── sysfiles/               # 知识库（标签/规则/技能）
├── data/                   # 向量数据库文件
│   └── zvec/
│       ├── sysknowledge_dim1536/
│       ├── sysknowledge_dim1024/
│       └── *.broken/       # 损坏的集合（保留不删）
└── .env                    # 环境变量（不上传，用服务器的）
```

### 关于 `.next` 的说明

- **打包时排除**：macOS 上不打包 `.next/`（内容来自 Next.js build）
- **服务器上构建**：`npm run build` 在服务器生成 `.next/standalone/`
- **static 目录**：`postbuild-copy-zvec-bindings.sh` 确保 `static` 被复制到 standalone 可访问的位置

---

## 六、验证部署成功

```bash
# 1. 检查服务进程
ps aux | grep "node.*standalone" | grep -v grep

# 2. 检查端口监听
lsof -i :3000

# 3. HTTP 健康检查
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# 期望：200

# 4. CSS 静态文件
curl -s http://localhost:3000/ | grep -o 'href="/_next/static/css/[^"]*"' | head -1
# 然后用返回的 URL 测试，应返回 200

# 5. 公网访问
curl -s -o /dev/null -w "%{http_code}" http://119.45.168.110:3000/
# 期望：200

# 6. 查看日志
./scripts/install-deploy.sh logs
```

---

## 七、安全注意事项

1. **.env 不上传**：包含数据库密码、API Key 等敏感信息，每个服务器独立配置
2. **NEXTAUTH_SECRET**：生产环境必须设置强随机字符串
3. **MySQL 密码**：使用强密码，限制 localhost 访问
4. **腾讯云安全组**：仅开放必要端口（3000）

---

## 八、快速参考（一行命令）

```bash
# 完整部署（假设代码已更新）
rsync -av --delete /tmp/navicauseffect-deploy/ root@119.45.168.110:/opt/navicauseffect/ \
  && ssh root@119.45.168.110 "cd /opt/navicauseffect && ./scripts/install-deploy.sh build && ./scripts/install-deploy.sh start"
```
