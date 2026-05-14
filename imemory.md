# imemory.md — 错误与教训记录

> 用途：记录项目开发过程中犯过的错误、踩过的坑、总结的经验教训。
> 在规划设计实现、分析复盘和其它时候应参考本文件，避免重复犯错。
> 每次发现问题或复盘出教训时追加记录，按时间倒序排列。

---

## 2026-05-12 Hybrid 解盘 500 与冒烟超时

### E-50: 已 `db push`/迁移加列，仍报 `Unknown argument hybridState` / Prisma create 失败

- **现象**：`_debug` 里 `Unknown argument 'hybridState'. Available options are marked with ?`，或长 JSON 截断后误判为 chartData 问题
- **根因**：**`@prisma/client` 未随 schema 重新生成**（或 dev 进程未重启仍加载旧 client），运行时 API 与当前 `schema.prisma` 不一致；`_debug` 只截前 800 字时看不到句末的真正原因
- **教训**：变更 Prisma 模型/字段后必须 **`pnpm prisma generate`**，并 **重启 Next**；交付前对 Prisma 类错误把 `_debug` 拉长或保留尾部，避免只看到半截 `data: { ...`
- **关联**：`pnpm run smoke:reading` 交付前至少 `SMOKE_SKIP_LLM=1` 跑通快路径；全量流式须模型可用；Node 默认 `fetch` 对慢响应头有 **300s** 限制时解盘请求用 undici `Agent`（见 `scripts/smoke-hybrid-reading.ts`）；**Anthropic 兼容 `ClaudeProvider` 流式 `fetch` 须带超时**，否则上游挂死时 Next 长期不返回响应头

## 2026-05-11 登录与 seed 约定

### E-49: admin / ffffff 无法登录 — seed 默认密码与文档不一致

- **现象**：用 `admin` / `ffffff` 登录 NextAuth 失败；误以为未写入数据库
- **根因**：`NextAuth` 的 `authorize` **只校验 `User.password`**，与 `AdminConfig.admin_password_hash` 无直接关系；`prisma/seed` 曾默认 `ADMIN_PASSWORD=changeme`，与 `install.sh`、CLAUDE 文档中的 **ffffff** 不一致
- **教训**：seed 默认管理员明文须与 `install.sh`、文档、自测脚本一致；说明「登录读 User 表」避免与 AdminConfig 混淆
- **已修复**：`prisma/seed.ts` **固定**写入 `admin` / `ffffff`、`ADMIN`、`YEARLY` 会员；`check-admin-db` / `auth-flow-test` 同步。已用旧 seed 的库执行 `pnpm db:seed` 覆盖即可

## 2026-04-28 生产部署踩坑

### E-48: Mac 打包时 tar 写入 macOS xattr，Linux 解压大量警告

- **现象**：`tar xzf` 时大量 `Ignoring unknown extended header keyword 'LIBARCHIVE.xattr.com.apple.provenance'`
- **根因**：macOS 的 tar 默认将扩展属性（xattr）写入 POSIX 扩展头，Linux tar 不认识这些关键字
- **教训**：打包时必须加 `--no-xattrs`（已加）且 `COPYFILE_DISABLE=1`（已加），但 macOS tar 的 provenance xattr 仍会泄露；考虑用 `--pax-option=delete=atime,delete=ctime` 或 `--format=gnu` 彻底排除
- **已修复**：`build-release.sh` 已有 `--no-xattrs` 和 `COPYFILE_DISABLE=1`；仍有残留警告但不影响功能

### E-47: 服务器缺少 data/zvec/ 目录，向量化报错

- **现象**：点击向量化时提示缺少 `/opt/navicauseffect/data/zvec`
- **根因**：`build-release.sh` 不创建空目录，standalone 输出不含 `data/` 目录；首次部署时 `install.sh` 应创建但可能被跳过
- **教训**：`start-prod.sh` 必须在启动前 `mkdir -p` 所有必要数据目录（已做）
- **已修复**：`install.sh` 和 `start-prod.sh` 都有 `mkdir -p data/zvec/...`

### E-46: 数据库未创建，缺少 ziwei_sessions 等表

- **现象**：服务器数据库没有 ziwei_sessions 等新表
- **根因**：`start-prod.sh` 用 `prisma migrate deploy`（依赖 migrations 目录和完整 CLI），但 standalone 缺少 `@prisma/debug` 等间接依赖导致迁移失败
- **教训**：standalone 部署用 `prisma db push`（install.sh 已用）而非 `migrate deploy`；或首次部署前先在服务器手动 `db push`
- **已修复**：`install.sh` 使用 `db push`；`start-prod.sh` 迁移降级为 best-effort

### E-45: retag 进度文件 rename 失败 — ENOENT

- **现象**：打标出错 `ENOENT: no such file or directory, rename .retag-progress.tmp → .retag-progress.json`
- **根因**：`data/zvec/` 目录不存在时 `writeFile(.tmp)` 失败，后续 `rename` 自然也失败
- **教训**：写文件前须确保父目录存在（`mkdir -p`）；错误处理应区分「目录不存在」和「rename 失败」
- **关联**：E-47 的子问题

### E-44: standalone 缺少 Linux 平台 @zvec/bindings-linux-x64

- **现象**：Zvec 原生绑定无法加载，所有向量操作失败
- **根因**：macOS 构建时 Next.js file tracer 只跟踪 darwin-arm64 绑定；linux-x64 绑定需手动安装并拷贝
- **教训**：含 `.node` 原生绑定的包必须**显式处理跨平台**：构建时 `npm install @zvec/bindings-linux-x64 --force`，然后手动拷贝到 standalone 的 node_modules
- **已修复**：`postbuild-copy-zvec-bindings.sh` + `build-release.sh` 验证步骤

### E-43: standalone server.js 未设置 HOSTNAME=0.0.0.0，默认只监听 localhost

- **现象**：服务器上 `node server.js` 启动后外网无法访问
- **根因**：Next.js standalone 的 server.js 默认监听 localhost；须设置 `HOSTNAME=0.0.0.0`
- **教训**：生产启动命令必须带 `HOSTNAME=0.0.0.0` 环境变量
- **已修复**：`start-prod.sh` 中 `HOSTNAME=0.0.0.0 node server.js`

### E-42: standalone 缺少 Prisma 引擎和客户端

- **现象**：服务器上 Prisma 报错找不到引擎或客户端
- **根因**：standalone file tracer 不跟踪 Prisma 的 `.so.node` 原生引擎和 `@prisma/client` 运行时
- **教训**：Dockerfile / build-release.sh 必须**显式拷贝** Prisma 相关文件：`node_modules/.prisma/`、`node_modules/@prisma/`、`prisma/` 目录
- **已修复**：`build-release.sh` 拷贝 prisma 全家桶 + 验证 rhel 引擎存在

### E-41: imemory.md 从 4/9 停止更新，20 天错误零记录

- **现象**：imemory.md 最后一条停留在 E-32（约 4/8），此后 4/25、4/27、4/28 三个会话的所有错误教训均未记录
- **根因**：**未执行 CLAUDE.md 的强制规则**「发现错误/教训 → 自动追加到 imemory.md」；这是纯粹的行为违规，没有技术原因
- **教训**：**每个 catch 到的 bug、每个排查超过 5 分钟的问题、每次部署踩坑，必须立即写入 imemory.md**。这不是「有空再补」的可选项，是交付流程的一部分。忘记记录 = 同样的错误会再犯。

---

## 2026-04-27 RAG 管道修复（4/27 全天会话）

### E-40: maxTokens 过低导致 AI 输出截断

- **现象**：加入运限数据后 AI 分析更长，输出在中间截断
- **根因**：`step4-generator.ts` 的 `maxTokens: 1500` 不够用
- **教训**：调整 prompt 内容后须同步评估 maxTokens 是否充足；生产环境建议 3000+，可配置
- **已修复**：`maxTokens` 从 1500 调到 3000

### E-39b: iztro HoroscopeItem 属性名用错

- **现象**：取大限/流年宫位名和四化星时返回 undefined
- **根因**：用了不存在的 `palaceName`（单字符串）和 `luStar`，实际 API 是 `palaceNames`（数组）和 `mutagen`（四化星数组）
- **教训**：iztro fork 的 API 须以实际 TypeScript 声明为准，不能凭名称猜测
- **已修复**：`horoscope-computer.ts` 改为 `palaceNames` 和 `mutagen`

### E-38b: Step3 retriever SQL 列名大小写不一致

- **现象**：精准召回始终返回空结果
- **根因**：SQL 查询用 `topic_type` 但 Prisma schema 定义的是 `topicType`（camelCase），3 处写错
- **教训**：Prisma + MySQL 时 SQL 中的字段名必须与 schema 一致；用 Prisma 的 `where` 而非原始 SQL 可避免此类问题
- **已修复**：step3-retriever.ts 中 3 处 `topic_type` → `topicType`

### E-37b: 流式模式下会话回复为空

- **现象**：ChatPanel 的追问回复内容为空
- **根因**：流式模式下 route.ts 拼接全文后才写入 sessionManager，但中间件只拿到空串
- **已修复**：route.ts 中流式全文拼接后写入 sessionManager

### E-36b: vectorFallback 维度错配

- **现象**：向量化 fallback 时维度与集合不一致
- **根因**：`cfg` 和 `usedFamily` 没统一为单一 family
- **已修复**：统一 cfg 与 usedFamily

### E-35b: Zvec doc_id 包含中文/冒号/斜杠导致 upsert 失败

- **现象**：向量化时部分切片 upsert 失败
- **根因**：doc_id 从文件路径生成，包含中文、`/`、`:`等 Zvec 不允许的字符
- **教训**：Zvec doc_id 只允许 `[a-zA-Z0-9_-]`，生成时必须 sanitize
- **已修复**：`sanitizeZvecId()` 替换非法字符为下划线

### E-34b: Zvec 集合字段类型错误 — 字符串 vs 数组

- **现象**：向量检索结果中 biz_modules/stars/palaces 为字符串而非数组
- **根因**：索引脚本写入时用了字符串，schema 定义的是 ARRAY_STRING
- **已修复**：确保写入时传数组类型

### E-33b: embedding 实际维度与预期不一致（2048 而非 1024）

- **现象**：智谱 embedding-3 模型实际输出 2048 维，但代码期望 1024
- **根因**：未实际调用 API 测试维度，凭文档假设
- **教训**：索引脚本必须先调一次 embedding API 测实际维度，动态创建对应集合
- **已修复**：`index-ziwei-knowledge.ts` 增加 `actualDim` 自动检测

---

## 2026-04-25 首页性能优化

### E-32b: JWT 回调每次请求查库，首页加载极慢

- **现象**：首页加载 3-5 秒
- **根因**：`jwt()` callback 每次请求都查数据库，即使 session 未变化
- **教训**：JWT callback 应只在登录（`user.id` 存在）和主动刷新（`trigger === 'update'`）时查库，其余从 token 直接返回
- **已修复**：`src/lib/auth/index.ts` jwt callback 增加条件判断

### E-31b: 中文字体文件 4.4MB，首页加载慢

- **现象**：Noto Serif SC / Sans SC 字体文件 4.4MB
- **根因**：`next/font/local` 加载完整字体而非子集
- **已修复**：用 `pyftsubset` 裁剪到 3900+ 常用字符，4.4MB → 1.3MB

### E-30: 首页无 loading 状态，白屏等待

- **现象**：首页加载时长时间白屏
- **根因**：缺少 Suspense boundary 和 loading.tsx
- **已修复**：`layout.tsx` 包裹 Suspense + 新增 `loading.tsx`

---

## 2026-04-28 生产部署踩坑（build-release.sh / 打包相关）

### E-33: release 包未包含运维脚本，生产环境无法建索引

- **现象**：服务器上 `npm run sysknowledge:index-zvec` 报 `Cannot find module ... logicdoc-index-zvec.ts`
- **根因**：`build-release.sh` 只拷了 `start-prod.sh`、`install.sh`、`seed-ai-models.js`，所有 `.ts` 运维脚本和 `tsx`（devDependency）都不在 standalone 输出里
- **教训**：打包脚本须覆盖**所有生产环境需要执行的操作**（索引、retag 等），不能只拷启动脚本；TS 脚本用 esbuild 编译为独立 JS（避免依赖 tsx）
- **已修复**：`build-release.sh` 增加 esbuild 编译步骤，输出 `.cjs` 文件

### E-34: esbuild 编译为 ESM 时 CJS 命名导出不兼容

- **现象**：编译后的 `.mjs` 在服务器上报 `Named export 'ZVecCollectionSchema' not found from CJS module`
- **根因**：`@zvec/zvec` 是 CommonJS 包，Node.js ESM 不支持从 CJS 命名导入非 `module.exports` 顶层的导出
- **教训**：依赖含 CJS 原生绑定的包时，esbuild 编译运维脚本必须用 `--format=cjs`（不能用 `esm`）
- **已修复**：`build-release.sh` 改为 `--format=cjs`，输出 `.cjs`；`package.json` scripts 同步更新

### E-35: ZVec readOnly 模式需要 LOCK 文件存在（删了反而报错）

- **现象**：删除 LOCK 文件后 `ZVecOpen(path, { readOnly: true })` 报 `Can't open lock file`
- **根因**：ZVec 即使 readOnly 也尝试 fcntl/flock LOCK 文件；文件不存在时 open() 失败
- **教训**：**不要删除 Zvec collection 的 LOCK 文件**；如果怀疑锁残留，应覆盖为空文件（`touch LOCK`）而非 `rm`；进程异常退出后 LOCK 文件为空（0B）是正常的，不代表锁被占用
- **已修复**：`step3-retriever.ts` 打开前检查空 LOCK 并保留；`start-prod.sh` 启动时 `find -name LOCK -size 0` 清理空锁（实际改为不删除）

### E-36: ZVec 集合数据被索引进程崩溃损坏

- **现象**：ZVecOpen 成功但 WARN `ForwardBlock already exists (possible crash residue)`，idmap 写入报 `Not supported operation in read only mode`
- **根因**：索引进程被 kill 时正在写入 segment，留下半写的数据文件；readOnly 打开时无法修复这些残留
- **教训**：杀进程前应让索引脚本优雅退出（捕获 SIGTERM → col.closeSync()）；如果已损坏，只能删除整个 collection 目录重建索引
- **已修复**：生产环境建索引须在 `node scripts/index-ziwei-knowledge.cjs` 完成后再启动服务

### E-37: admin 密码哈希不匹配 — install.sh 只创建不更新

- **现象**：`bcrypt.compare('ffffff', hash)` 返回 false，无法登录
- **根因**：`install.sh` 用 `findUnique` 检查 admin 存在后跳过，不更新密码；旧部署的 admin 有不同密码
- **教训**：生产部署后须显式重置 admin 密码（或 install.sh 改为 upsert）；调试 CredentialsSignin 时先验证 `bcrypt.compare` 而非猜方向
- **已修复**：部署流程增加密码重置步骤

### E-38: catch 块吞掉真实错误信息，浪费大量调试时间

- **现象**：Step3 只输出「Zvec 集合不存在或无法打开」泛泛一句，实际原因可能是 LOCK、权限、数据损坏等
- **根因**：`step3-retriever.ts` 的 `catch {}` 不打印 error message
- **教训**：**所有 catch 块必须打印 `(e as Error).message`**，禁止空 catch 或只打印自定义文案；泛泛的错误描述 = 毫无诊断价值
- **已修复**：`step3-retriever.ts` catch 中增加 `(e as Error).message` 输出

### E-39: standalone 输出缺少 @prisma/debug 等间接依赖

- **现象**：`prisma migrate deploy` 报 `Cannot find module '@prisma/debug'`
- **根因**：standalone file tracer 只跟踪运行时直接引用的 Prisma 子包，CLI 依赖的 `@prisma/debug`、`@prisma/engines` 等未被打包
- **教训**：standalone 部署不依赖 `prisma migrate deploy`，改用 `prisma db push` 或预先生成 migration SQL；`install.sh` 是正确的入口（用 `db push` 而非 `migrate deploy`）
- **已修复**：`start-prod.sh` 的迁移步骤降级为 best-effort（失败仅 warn）

---

## 2026-04-08 用户显性规范：服务端改动后须自觉重启 dev

### E-29: 用户明确要求「需要重启时由助手重启」，不得让用户自己动手

- **现象**：用户多次提醒：改完代码若需重启开发服务，助手应**主动**处理，却总停留在口头说明「请你重启」。
- **根因**：未把 **dev-server 收尾** 固化进每一轮交付动作；与 `.cursor/rules/dev-server.mdc`、E-22/E-25 的「禁止把停启服务甩给用户」冲突。
- **教训（强制纪律）**：在 **navicauseffect** 完成会影响运行中 Node 进程的改动（API、`src/lib`、middleware、`.env` 相关说明后用户会去改、Prisma 等）后，**同一轮收尾必须**：
  1. `lsof -i :3000` 看是否已有本项目的 `next dev`；
  2. 若需重启：先 **kill** 占用 3000 的进程，再在项目根 **后台** 执行 `npm run dev`；
  3. 可选 `curl -I http://localhost:3000` 确认可访问；
  4. 在回复里**简短写明**已重启或已确认在跑。
- **禁止**：仅写「请自行重启」而不在环境里执行上述步骤（除非用户环境明确无法执行命令）。

---

## 2026-04-08 Embedding 解析与运维

### E-27: Embedding HTTP 200 仍报「响应中无向量数据」

- **现象**：解盘/检索阶段抛出 `Embedding 响应中无向量数据`，后台配置看似已保存。
- **根因**：只认 OpenAI 形态 `data[0].embedding`；厂商返回 **base64**、`output.embeddings` 包裹、或非标准嵌套时解析失败；Base URL 误写成带 `/embeddings` 时再拼路径导致请求异常；**向量维度与 Zvec 集合不一致**时此前可能拖到更晚才暴露。
- **教训**：请求默认 `encoding_format=float`（不兼容时可用 `EMBEDDING_OMIT_ENCODING_FORMAT=1`）；解析走多路径 + base64 float32 解码；Base URL 归一避免重复 `/embeddings`；对 1536/1024 族 **强制维度校验**；管理后台提供 **试调接口** 便于与「分析链路」同源验证。
- **已修复**：`src/lib/zvec/parse-embedding-response.ts`、`embedding-url.ts`、`fetch-embedding.ts`；`POST /api/admin/embedding-config/test` 与 Embedding 页「测试连接」。
- **补充（MiniMax）**：HTTP 200 且顶层为 `vectors` + `base_resp` 时须解析 `vectors[0]` 为 float 数组，并视 `base_resp.status_code !== 0` 为业务失败（勿只认 `data[0].embedding`）。
- **补充（MiniMax 请求）**：原生接口要求 **`texts` 数组** 与 **`type`**（`db` 建库 / `query` 检索），不能用 OpenAI 的 `input`；否则会报 `missing required parameter`（expr_path=texts）。

### E-28: `insufficient balance` 被误认为程序 Bug

- **现象**：测试连接或建索引报 `Embedding 业务错误: insufficient balance`。
- **根因**：厂商返回 **账户余额/套餐用尽**，属**计费侧**，应用层无法通过改代码消除。
- **教训**：须在 UI/错误文案中明确「去控制台充值或换 Key」；自动化自测只能覆盖解析与请求体，**不能**替代有余额的联调。
- **已做**：`enrichEmbeddingBusinessMessage` + 后台黄色计费说明；`npm run test:embedding-pipeline` 验请求/解析/错误格式。

---

## 2026-04-07 交付与规范违反（必须避免重复）

### E-20: 分块器内层循环在 `pos === 0` 时永不退出（CPU 100%）

- **现象**：索引或处理以换行开头的 docx/正文时，Node 进程打满单核、看似卡死。
- **根因**：`lastIndexOf(sep, pos - 1)` 在 `pos === 0` 时变为 `lastIndexOf(..., -1)`；按 ECMAScript 行为会从索引 0 查找，分隔符恰在 0 时 **`pos` 恒为 0**，`while (pos >= 0)` 无法结束。
- **教训**：凡「从后往前扫分隔符」的循环，必须在 **`pos === 0` 且当前位置不满足切分条件时显式 `break`**，或保证每步严格减小 `pos`；对**边界输入**（全空白、首字符即分隔符）做手推或写最小单测。
- **已修复**：`src/lib/logicdoc/chunk-text.ts` 增加 `pos === 0` 分支 + 外层最大迭代兜底。

### E-21: Turbopack 在部分工作区路径下错误解析 `@import "tailwindcss"`（页面一直转圈）

- **现象**：`Can't resolve 'tailwindcss' in '/Users/martin/dev'`（上下文落在**项目上一级目录**），编译失败；浏览器长时间加载、像「在刷」。
- **根因**：Next 16 默认 Turbopack 处理 CSS 时，增强解析的 **context 目录**与仓库实际根不一致（如多文件夹工作区、父级无 `package.json`）。
- **教训**：**改完构建链/CSS 后必须用 `curl` 或浏览器验证首页能 200**，不能假定 Ready 即正常；Tailwind v4 + Turbopack 组合在异常根目录下不可靠时，应 **显式采用 `next dev --webpack` / `next build --webpack`** 并写入 `package.json`，并在对照表/CLAUDE 中留痕。
- **已修复**：`package.json` 的 `dev`/`build` 增加 `--webpack`；`next.config.mjs` 保持简洁可用。

### E-22: 违反 CLAUDE.md / 用户规则：把「停服务」推给用户执行

- **现象**：回复里写「请你本地 Ctrl+C / 自己停掉进程」，而不是助手在环境里执行。
- **根因**：未严格按 **用户规则**（须由助手执行命令）与 **`.cursor/rules/dev-server.mdc`**（自检与处理端口/进程）执行。
- **教训**：遇到端口占用、僵尸 `next dev`、卡死进程时，**助手应直接 `pkill`/`lsof|kill` 并验证端口**，再按需后台拉起；**禁止**把可自动完成的操作用「请你…」甩给用户。
- **执行要求**：此后凡涉及停/启 3000 服务，默认由助手在终端完成并简短汇报。

### E-23: `next.config.ts` 中使用 `createRequire` 触发 `exports is not defined in ES module scope`

- **现象**：Next 加载配置失败，开发服务起不来。
- **根因**：Next 对 `next.config.ts` 的编译产物与 `createRequire`/CJS 互操作在部分版本下不兼容。
- **教训**：配置里需要路径时优先 **`import.meta.url` + `path.join(__dirname, 'node_modules/...')`** 的纯 ESM 写法，或改用 **`next.config.mjs`**；**改 config 后立即 `npm run dev` 试跑**，避免连续叠加未验证的修复。

### E-24: 写完代码未做交付前审查（违反 CLAUDE.md「交付前自测与评审」）

- **现象**：分块死循环、构建/配置错误等**本应审查或一行单测就能发现**的问题流入交付。
- **根因**：实现后**没有**按规范做：通读 diff、盯循环/边界、跑 `tsc`、动到 next/tailwind 时**起 dev + 请求首页**；也未调用工作区约定的 **code-reviewer** 子代理做第二遍检查。
- **教训（强制纪律）**：凡**非琐碎**改动（新模块、循环、原生包、next.config、新依赖），交付前**必须**至少完成：
  1. **自审 diff**：循环递减条件、`lastIndexOf`/`while` 边界、异步与锁、错误路径是否可到达用户。
  2. **`npx tsc --noEmit`**。
  3. **触达构建或 CSS**：`npm run dev`（或 `build`）+ **HTTP 验首页**（如 `curl -I localhost:3000`）。
  4. **可选但推荐**：对工作区启用 **code-reviewer** 子代理过一遍本次 diff。
- **与规范关系**：对应 **CLAUDE.md**「交付前：自测 + 需求评审」及 **`.cursor/rules/delivery-and-review.mdc`**；缺任何一项不得声称交付完成。

### E-26: Embedding 后台保存「不生效」— 缓存与静默回退 .env

- **现象**：管理后台保存 Embedding 后，界面或运行时仍像旧配置。
- **根因**：① 浏览器或中间层 **GET 缓存** 了 `/api/admin/embedding-config`；② 数据库 `config_value` 解析失败时 **`getEmbeddingConfigForFamily` 静默改用 `.env`**，与「以为已写库」矛盾；③ 用户期望改模型立刻影响旧索引（需 **重建索引** 才有新向量）。
- **教训**：管理类 GET API 须 **`Cache-Control: no-store`** + `dynamic = force-dynamic`；客户端 **`fetch(..., { cache: 'no-store' })`**；库中已有行但解析失败时应 **报错或打日志，禁止无提示回退 env**；产品文案写明 **DB 优先于 env** 与 **改模型要重建索引**。
- **已修复**：`embedding-config` 路由与 Embedding 页 fetch；`embedding-config.ts` 规范化 Json、兼容 snake_case、有行不可解析时不再静默用 env。

### E-25: 改完代码不主动判断/重启 dev，等用户提醒才起服务

- **现象**：用户发现 localhost 连不上或配置未生效，需反复说「起一下服务」「重启」。
- **根因**：未把「交付前服务状态」纳入默认动作；与用户要求及 **`.cursor/rules/dev-server.mdc`** 不符。
- **教训**：每次在本项目改完代码准备收尾时，按 **dev-server.mdc §2** 自判是否重启；需要或 3000 无监听则 **kill + 后台 `npm run dev`**，并可选 `curl -I` 验证；**禁止**默认假设服务仍在跑。
- **规则落点**：已写入 **`.cursor/rules/dev-server.mdc`**（§2 改完代码后自行判断、§3 启动/重启）；**CLAUDE.md** 开发与自测约定已引用。

---

## 2026-04-02 全面代码审查发现的问题与教训

### E-01: Google Fonts 在中国网络不可达导致构建失败

- **现象**：`next build` 因无法连接 `fonts.googleapis.com` 而失败
- **根因**：`src/app/layout.tsx` 使用 `next/font/google` 加载 Noto Serif SC 和 Noto Sans SC，中国服务器无法访问 Google Fonts
- **教训**：面向中国用户的项目不应依赖 Google Fonts 在线加载；应使用 `next/font/local` 自托管字体文件，或使用国内 CDN 镜像
- **修复方案**：下载字体文件到 `public/fonts/`，改用 `next/font/local` 加载

### E-02: 支付回调未校验签名 — 任何人可伪造支付成功

- **现象**：`src/app/api/payment/callback/route.ts` 仅有 `// TODO: verify WeChat Pay / Alipay callback signature` 注释，未实际校验
- **根因**：开发阶段为了方便测试跳过了签名验证
- **教训**：支付相关安全逻辑**绝不能留 TODO**；即使在开发环境也应至少实现基础校验
- **修复方案**：接入微信支付/支付宝 SDK，实现 HMAC 签名校验

### E-03: 管理后台缺少 admin 角色校验

- **现象**：middleware.ts 仅检查用户是否登录，不检查 role 是否为 ADMIN；任何已登录用户均可访问 /admin
- **根因**：middleware 中 `protectedPaths` 只判断了 `!req.auth`，未检查 session.user.role
- **教训**：权限控制应在最外层（middleware）就做拦截，不能仅靠前端 UI 隐藏
- **修复方案**：在 middleware 中增加 admin 路径的角色检查

### E-04: 手机登录验证码未校验

- **现象**：`src/lib/auth/index.ts:78` 手机号登录 Provider 中 `// TODO: verify SMS code from Redis`
- **根因**：短信服务未接入就先上线了登录流程
- **教训**：认证流程不应有跳过环节，至少应在 Redis 中存验证码并校验
- **修复方案**：实现 Redis 验证码存取 + 过期机制

### E-05: API Key 字段名暗示加密但实际明文

- **现象**：Prisma schema 中 `apiKeyEncrypted` 字段名包含 "Encrypted"，但代码中直接传递给 Provider 构造函数
- **根因**：字段命名与实际使用不一致
- **教训**：字段命名应如实反映其内容；如果存储加密，读取时必须解密
- **修复方案**：要么实现加解密（如 AES），要么重命名字段为 `apiKey` 并确保 DB 访问控制

### E-06: 重复的 generateInviteCode 函数

- **现象**：`src/lib/auth/index.ts` 和 `src/app/api/auth/register/route.ts` 各有一个 `generateInviteCode`
- **根因**：两处独立编写，未提取公共函数
- **教训**：通用工具函数应在第一时间提取到 `src/lib/utils.ts` 或独立模块
- **修复方案**：提取到 `src/lib/invite-code.ts`，两处引用

### E-07: 多处使用 any 类型

- **现象**：`analysis-panel.tsx` 和 `ziwei-analysis-panel.tsx` 中大量 `any`
- **根因**：快速开发时用 any 绕过类型检查
- **教训**：项目配置了 `strict: true` 却在组件中用 any，降低了类型安全的价值；应在开发时就定义好接口类型
- **修复方案**：定义 `AstrolabeData`、`HoroscopeData`、`ZiweiAnalysisResult` 等类型接口

### E-08: 限流 Redis GET + INCR 非原子操作

- **现象**：`checkDailyLimit` 先 GET 检查，再由 `incrementDailyUsage` INCR
- **根因**：两步操作之间可能被并发请求穿透
- **教训**：Redis 计数限流应使用 Lua 脚本或 INCR + 条件判断一步完成
- **修复方案**：使用 Redis Lua 脚本实现原子化限流

### E-09: 环境变量注释与代码默认值不一致

- **现象**：`.env.example` 注释说 `ANALYSIS_MAX_OUTPUT_TOKENS` 默认 4096，但代码 `analysis-limits.ts` 默认 16384
- **根因**：代码优化后未同步更新 .env.example 注释
- **教训**：环境变量默认值变更时必须同步更新 `.env.example` 注释
- **修复方案**：更新 .env.example 注释为 "默认 16384"

### E-13: 支付订单履约未使用数据库事务

- **现象**：`fulfill-order.ts` 先 `update` 订单状态为 PAID，再 `upsert` 会员/加次；如果第二步失败，订单已标记 PAID 但用户未获权益
- **根因**：两步操作未包裹在 Prisma `$transaction` 中
- **教训**：涉及多表写入的业务操作必须用数据库事务保证原子性
- **修复方案**：使用 `prisma.$transaction()` 包裹订单更新 + 权益开通

### E-14: AI Provider 同步响应未校验数据结构

- **现象**：`deepseek.ts:62`、`zhipu.ts:62`、`qwen.ts:62` 中 `data.choices[0].message.content` 无空值检查
- **根因**：假设 API 返回格式一定正确
- **教训**：外部 API 响应格式不可信，必须校验关键字段存在性
- **修复方案**：添加 `data?.choices?.[0]?.message?.content` 空值守卫

### E-15: 用户输入未转义直接拼入 AI Prompt

- **现象**：`buildAnalysisPrompt` 中 `astrolabeData.palaces` 等 JSON 直接拼入 user message
- **根因**：命盘数据来自前端构造，可能被篡改
- **教训**：用户可控数据注入 AI prompt 存在 Prompt Injection 风险；至少应对 JSON 做截断和清洗
- **修复方案**：对注入 prompt 的用户数据做长度截断 + 移除 prompt 指令关键词

### E-16: 外部 API 调用缺少超时设置

- **现象**：所有 AI Provider 的 fetch 请求均无 timeout 配置
- **根因**：Node.js fetch 默认无超时，网络异常时可能无限挂起
- **教训**：所有外部 API 调用必须设置合理超时（建议 30-60 秒）
- **修复方案**：使用 `AbortController` + `setTimeout` 实现请求超时

### E-17: X-Forwarded-For 可被伪造绕过限流

- **现象**：`analysis/route.ts:48` 使用 `request.headers.get("x-forwarded-for")` 获取 IP
- **根因**：该 header 可由客户端伪造
- **教训**：IP 获取应优先使用 Nginx 转发的可信 header，而非直接读 X-Forwarded-For
- **修复方案**：在 Nginx 配置 `set_real_ip_from`，或在应用层信任固定代理 IP

### E-18: 分享积分接口无限流

- **现象**：`/api/share` 无每日次数限制
- **根因**：遗漏了该接口的限流
- **教训**：所有涉及资源获取（积分、次数、权益）的接口必须有限流
- **修复方案**：添加与 analysis 相同的每日限流机制

### E-19: 路由组缺少 error.tsx 和 loading.tsx

- **现象**：`(main)` 和 `(admin)` 路由组均无 `error.tsx` 和 `loading.tsx`
- **根因**：开发时未创建
- **教训**：Next.js App Router 项目应在每个路由组创建 error boundary 和 loading UI
- **修复方案**：添加 `src/app/(main)/error.tsx`、`src/app/(main)/loading.tsx`、`src/app/(admin)/error.tsx`、`src/app/(admin)/loading.tsx`

---

## 2026-03-28 历史会话记录的经验

### E-10: JWT callback 在 Edge Runtime 中不能使用 Prisma

- **现象**：登录成功后 session 被清空，无法进入 /admin 或 /profile
- **根因**：JWT callback 在 Edge Runtime（middleware）中调用 Prisma 查库，Prisma 不支持 Edge，导致 JWT 解码失败、cookie 被清空
- **教训**：NextAuth v5 的 JWT callback 可能运行在 Edge，必须用 `process.env.NEXT_RUNTIME === "edge"` 判断并跳过 Prisma 调用
- **已修复**：增加了 Edge 环境判断，Node 侧才同步 DB

### E-11: 双 iztro 版本导致 i18n 实例不一致

- **现象**：命盘中心区等文案显示英文 key（如 `titleBasicInfo`）
- **根因**：根依赖 iztro 2.5.8 + iztro-hook 下 iztro 2.5.3 双版本共存，i18n 资源注册到不同实例
- **教训**：Monorepo 或 `file:` 引入本地包时，必须用 `overrides` 确保全局唯一实例
- **已修复**：方案 B 双 Fork 集成，`overrides.iztro: "file:./packages/iztro"` 强制单实例

### E-12: 知识库过大导致 AI 上下文超限

- **现象**：流式解盘输出为空
- **根因**：`logicdoc/` 知识库文件总大小超过模型上下文窗口，system prompt 撑爆后无空间留给输出
- **教训**：注入知识库时必须设置截断上限（`LOGICDOC_MAX_CHARS` 默认 32000），并优先排列核心规则文件
- **已修复**：实现了截断机制 + 可配置上限

### E-32: RAG 词面重排后置底「通用/always」块时不可先于 TopK 截断

- **现象**：自测「仅通用」文档已向量化且 `biz_modules contain_any('通用')` 可命中，但主链路 `retrieveLogicdocForAnalysis` 拼接结果始终不含该文件。
- **根因**：对候选集先 `sortWeakBaselineLast` 再 `slice(0, topK)`，弱基线块被移到队尾后整体挤出 TopK。
- **教训**：应先按综合分截断 TopK，再在同一批结果内做「置底」重排以兼顾召回与 prompt 可读性。
- **已修复**：`logicdoc-retrieval.ts` 中改为先 `slice` 再 `sortWeakBaselineLast`。

### E-31: 仅配置单套 Embedding 时 logicdoc 索引整次失败、Zvec 始终无向量

- **现象**：对话用 MiniMax（1536）且后台只保存了 1536 维 embedding，但各解盘模块均提示「向量库无匹配片段」；用同一 query 向量对 `logicdoc_dim1536` 检索 topK 为 0。
- **根因**：`runLogicdocZvecIndex` 在开头**强依赖**两套 `getEmbeddingConfigForFamily`；未配 1024 时抛错退出，**从未 upsert**，集合仅有空壳或旧数据。
- **教训**：双 collection 设计下，索引任务须**按已配置维度分别写入**，缺哪套就跳过哪套，并打 warn；检索侧已按 provider 选维，与「可只存一套后台配置」一致。
- **已修复**：`logicdoc-indexer` 改为 `tryGet` + 仅打开有配置的 collection；`npm run test:rag-categories` 校验 7 类 RAG。

---

## 使用方式

- **规划时**：检查本文件是否有类似场景的教训
- **实现时**：参考已记录的修复方案，避免走弯路
- **复盘时**：将新发现的问题和教训追加到本文件
- **代码审查时**：将本文件作为检查清单的一部分
