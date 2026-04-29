# 腾讯云部署失败教训总结

> 最后更新：2026-04-29
> 教训来源：4月28日-29日连续部署踩坑记录

---

## 一周内犯的错误清单

### 1. Port 3000 冲突
**现象**：PM2 navicauseffect 进程报错 `EADDRINUSE: address already in use 0.0.0.0:3000`
**原因**：之前启动的 node 进程还占着 3000 端口
**解决**：`pkill -9 -f node` 或 `pkill -9 -f next-server`

### 2. PM2 安装失败
**现象**：`pm2: command not found`
**原因**：
- sudo 安装失败（权限认证问题）
- 全局安装路径不在 PATH 中
**解决**：PM2 安装在 `/home/martin/node_modules/.bin/pm2`，完整路径调用

### 3. PM2 不在 PATH
**现象**：`pm2: command not found`
**原因**：PM2 安装在用户目录，未加入系统 PATH
**正确路径**：`/home/martin/node_modules/.bin/pm2`

### 4. 服务器缺少 .env 文件
**现象**：服务启动成功但功能异常（如数据库连接失败）
**原因**：`.env` 文件未上传到服务器
**解决**：检查 `/opt/navicauseffect/.env` 是否存在

### 5. 构建失败 - next 命令找不到
**现象**：`Failed to start server - Could not find a production build`
**原因**：没有完整上传 `.next` 文件夹，或 BUILD_ID 对不上
**教训**：每次必须核对 BUILD_ID

### 6. scp 上传大文件中断/不完整
**现象**：部分文件缺失，CSS 404，JS chunk 404
**原因**：`.next` 文件夹 1.4GB，scp 超时或中断
**教训**：
- 上传前先删除服务器旧文件：`rm -rf /opt/navicauseffect/.next`
- 上传后必须验证关键文件是否存在

### 7. standalone 目录结构混乱
**现象**：BUILD_ID 不一致，部分静态文件 404
**原因**：
- standalone 的 `.next` 在 `.next/standalone/.next/` 下
- 只上传了部分文件
**正确结构**：
```
.next/standalone/
├── .next/
│   ├── static/      ← 必须是这个
│   ├── server/      ← 必须是这个
│   └── BUILD_ID
├── server.js
└── node_modules/
```
**教训**：只上传 `.next/standalone` 整个文件夹

### 8. PM2 启动目录不对
**现象**：`Could not find a production build in the './.next' directory`
**原因**：PM2 启动时工作目录不对，`server.js` 里 `dir = __dirname` 指向错误
**正确命令**：
```bash
cd /opt/navicauseffect/.next/standalone
~/.local/node_modules/.bin/pm2 start server.js --name navicauseffect
```

### 9. 没有验证 BUILD_ID
**现象**：代码已更新但服务还是旧代码
**原因**：上传了但 BUILD_ID 对不上
**教训**：每次上传后必须核对：
```bash
cat .next/BUILD_ID  # 本地
cat /opt/navicauseffect/.next/standalone/.next/BUILD_ID  # 服务器
```

### 10. 静态文件遗漏 - CSS/JS chunk 丢失
**现象**：
- `Failed to load resource: 404 _next/static/css/xxx.css`
- `ChunkLoadError: Loading chunk 2427 failed`
**原因**：只上传了部分 `.next` 文件，`static/chunks/` 缺失
**教训**：
- 上传后必须抽样验证：
```bash
curl -I http://119.45.168.110:3000/_next/static/css/xxx.css
curl -I http://119.45.168.110:3000/_next/static/chunks/2427.xxx.js
```

### 11. Node 版本不一致
**现象**：本地 build 成功，服务器 build 失败
**原因**：服务器 Node 版本与本地不同
**教训**：记录并确认 Node 版本

---

## 部署检查清单

### Build 后（本地）
- [ ] `ls .next/standalone/.next/` → 确认有 `static/` 和 `server/` 文件夹
- [ ] `ls .next/standalone/.next/static/` → 确认有 `css/`、`chunks/`、`media/` 等
- [ ] `cat .next/BUILD_ID` → 记录 BUILD_ID
- [ ] `du -sh .next` → 确认大小（应该 1.4GB 左右）

### 上传前（服务器）
- [ ] `ssh martin@119.45.168.110 "rm -rf /opt/navicauseffect/.next"` → 清理旧文件

### 上传后（服务器）
- [ ] `cat /opt/navicauseffect/.next/standalone/.next/BUILD_ID` → 必须与本地一致
- [ ] `ls /opt/navicauseffect/.next/standalone/.next/static/` → 确认文件完整
- [ ] `du -sh /opt/navicauseffect/.next` → 应该 1.4GB 左右

### 重启服务后
- [ ] `~/.local/node_modules/.bin/pm2 list` → 确认 status 是 `online`，restarts 是 0
- [ ] `curl -sI http://119.45.168.110:3000/` → 确认 HTTP 200

### 功能验证
- [ ] 浏览器打开 `http://119.45.168.110:3000/chart`
- [ ] 打开浏览器控制台（F12）→ Network → 确认无 404
- [ ] 输入命盘信息，点击生成命盘
- [ ] 确认无 `ChunkLoadError`、`Failed to load resource` 等错误

---

## 正确的完整部署流程

```bash
# 1. 本地 build
npm run build

# 2. 确认 build 结果
ls .next/standalone/.next/
cat .next/BUILD_ID
du -sh .next

# 3. 清理服务器旧文件并上传
ssh martin@119.45.168.110 "rm -rf /opt/navicauseffect/.next"
scp -r .next/standalone martin@119.45.168.110:/opt/navicauseffect/.next/

# 4. 验证上传
ssh martin@119.45.168.110 "cat /opt/navicauseffect/.next/standalone/.next/BUILD_ID"
# 必须与本地一致！

# 5. 重启服务
ssh martin@119.45.168.110 "cd /opt/navicauseffect/.next/standalone && pkill -f next-server; ~/.local/node_modules/.bin/pm2 start server.js --name navicauseffect"

# 6. 验证服务
curl -sI http://119.45.168.110:3000/
```

---

## 关键路径备忘

| 项目 | 路径 |
|------|------|
| 项目目录 | `/opt/navicauseffect` |
| 启动目录 | `/opt/navicauseffect/.next/standalone` |
| PM2 路径 | `/home/martin/node_modules/.bin/pm2` |
| 服务端口 | 3000 |
| 服务器 SSH | `martin@119.45.168.110` |
| PM2 PID 文件 | `/home/martin/.pm2/` |

---

## 快速部署命令（复制粘贴用）

```bash
# 本地
npm run build

# 上传
ssh martin@119.45.168.110 "rm -rf /opt/navicauseffect/.next"
scp -r .next/standalone martin@119.45.168.110:/opt/navicauseffect/.next/

# 验证
ssh martin@119.45.168.110 "cat /opt/navicauseffect/.next/standalone/.next/BUILD_ID"

# 重启
ssh martin@119.45.168.110 "cd /opt/navicauseffect/.next/standalone && pkill -f next-server; ~/.local/node_modules/.bin/pm2 start server.js --name navicauseffect"

# 测试
curl -sI http://119.45.168.110:3000/
```
