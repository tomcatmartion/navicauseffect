# 功能交付记录（Work Result Doc）

按天记录项目功能的新增/优化/升级，便于回溯与理解项目演进。**每次完成可交付功能并交付给用户后，须在本文件追加一条记录。**

| 日期       | 功能名称             | 功能实现简述                                                                                                                                 | 状态   |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-05-25 | 父母出生年份输入功能 | 1) 新建 gan-zhi.ts 纯工具函数（yearToGan/yearToZhi/yearToZodiac）；2) iztro-reader 接受 parentBirthYears，注入父母干支到 ScoringContext，激活 step 2.4-2.7/4.4-4.7 父母四化加减分；3) 前端表单：年份+生肖拆分选择器，用户选年后点选正确生肖（春节前后跨两生肖年），根据选中生肖自动修正农历年份；4) 宫位能级详情展示父母四化具体干支和星曜名（如「父亲己干化禄·武曲」）；5) chart-pipeline-debug 新增 parentSihuaMeta 元数据；6) IR/Prompt 展示父母生年干支信息；7) ReadingRequestSchema 加 .passthrough() 保留 rawDates，修复太岁宫位错误；8) sessionStorage 持久化父母生肖选择。 | 新增 |
| 2026-05-24 | AI prompt 太岁宫位修复 | ReadingRequestSchema（Zod）只白名单 palaces/birthInfo/horoscope，strip 了 rawDates/chineseDate/solarDate，导致 iztro-reader 无法从农历数据覆盖生年干支，退回阳历直接算（2000→庚辰，实际己卯）。给 chartData 的 Zod object 加 .passthrough() 修复。 | 修复 |
| 2026-05-24 | 格局判定系统性 bug 修复 | 修复三大格局判定 bug：1) 四化被当星名处理导致误匹配；2) AND/OR 条件语义错误（要求所有子条件同宫才算满足）；3) 吉煞引动条件过于宽松。修正后格局识别准确率显著提升。 | 修复 |
| 2026-05-24 | 宫位能级展示修复 + API 清理 | 1) 宫位能级详情页展示修复，对齐评分引擎实际输出；2) 清理遗留 API 路由和冗余模块；3) 删除 pattern_library.json 冗余 definitions 段。 | 修复 |
| 2026-05-20 | config 层迁移入 src/core | 将 config 配置层从根目录迁移入 src/core，增强性格分析管线，清理遗留调试脚本，统一项目目录结构。 | 重构 |
| 2026-05-19 | 清理遗留 RAG/分析模块 | 清理遗留的 RAG/skills/hybrid/zvec/analysis 模块及关联管理页面，精简代码库，减少维护负担。 | 重构 |
| 2026-05-15 | 流式输出 JSON 过滤与 AI 超时 | 1) 流式输出过滤尾部 JSON 块（intent/memory_update），避免 AI 回复中显示原始数据；2) 延迟缓冲方案可靠过滤；3) AI 请求超时从 30s 提升到 120s，避免 Hybrid 长回复中断。 | 修复 |
| 2026-05-14 | Hybrid RAG 管道 + 分析面板重构 | 1) Hybrid RAG 管道实现（知识库检索 + AI 生成）；2) AI 模型管理后台增强；3) 分析面板重构（统一分析入口）；4) 主题系统支持。 | 新增 |
| 2026-05-14 | 评分/路由配置数据驱动化 | 1) 评分权重和路由规则从硬编码改为数据驱动（配置文件/数据库）；2) 会话管理增强（历史记录、上下文保持）。 | 重构 |
| 2026-05-14 | 构建问题修复 | 1) 添加 lunar-lite 依赖和 .npmrc 配置；2) 修复 TS 严格模式类型错误；3) pnpm 提升配置修复；4) 修复 rebase 导致的缩进错乱。 | 修复 |
| 2026-05-04 | 情感分析功能 | 1) 情感分析功能开发（文本情感检测与分类）；2) 多 AI Provider 优化（统一接口、错误处理、降级策略）。 | 新增 |
| 2026-05-02 | ICP 备案信息 | 添加 ICP 备案信息到页面底部，满足合规要求。 | 新增 |
| 2026-05-01 | step4 优化 + 产品改名 | 1) 参照 v2 优化解盘 SYSTEM_PROMPT 和 assembleContext，提升 AI 回复质量；2) 产品从"紫微心理"改名为"微著"，"紫微命理排盘"改为"微著排盘"。 | 优化 |
| 2026-04-30 | 方案C 部署脚本与生产部署 | 1) 方案C 部署脚本（pnpm + 服务器构建）；2) 修复 pnpm 在腾讯云无法安装问题（改用 npm 优先）；3) 改用 nohup 直接启动替代 PM2；4) 完善部署指南文档。 | 部署 |
| 2026-04-29 | RAG 意图识别 + ChatPanel UX 优化 | 1) RAG 意图识别功能（分析类型自动分类）；2) ChatPanel UX 优化；3) 排盘默认时间修复；4) 移除非流式自动聚焦；5) suppressHydrationWarning 修复。 | 新增 |
| 2026-04-28 | 生产部署工具链 + RAG 管道增强 | 1) 生产部署工具链完善；2) RAG 管道增加年份/运限数据支持；3) 调试面板增强；4) imemory 教训补录。 | 优化 |
| 2026-04-27 | 四步 RAG 精准召回管道 | 1) 四步 RAG 精准召回管道实现（查询→检索→重排→生成）；2) ChatPanel 接入 RAG；3) 向量化修复；4) Bug 修复。 | 新增 |
| 2026-04-25 | 首页性能优化 | 1) JWT 回调优化：仅登录时查库，后续从 token 读取，消除每次页面加载的 DB 查询；2) 字体子集化：4.4MB→1.3MB（覆盖 3900+ 字符），减少 70% 带宽；3) Suspense 包裹 Header/MobileNav + 骨架屏；4) 新建 (main) 路由组 loading.tsx | 优化 |
| 2026-04-25 | 上下文优化与 Skills 管理 | 1) claude-mem 注入量 50→15 条观察、会话数 10→3；2) 移除 23 个不相关 skill 到 _disabled 备份；3) 项目/全局 CLAUDE.md 精简；4) 新安装 prisma/context7/feature-dev/security-guidance 插件，重新启用 product-analysis/competitors-analysis/prompt-optimizer/github-ops/scrapling-skill | 优化 |
| 2026-04-24 | 知识库目录迁移与四库架构 | 1) 知识库数据目录从 `logicdoc/` 迁移至 `sysfiles/sysknowledge/`，标签库从 `systag/` 迁移至 `sysfiles/systag/`；2) 建立四库架构：systag（标签库）、sysknowledge（知识库）、sysrules（规则库）、systech（技法库），外加 sysmapping（映射表）；3) 更新所有代码中的数据路径引用（20+文件）、向量库路径（logicdoc_dim* → sysknowledge_dim*）、索引版本（sysknowledge-v3）；4) 更新文档（CLAUDE.md、CONTEXT.md、文件对照表）。 | 重构   |
| 2026-04-24 | 移除硬编码管理员密码 | 移除 `auth/index.ts` 中的 `isBuiltInAdmin` 硬编码后门（37行），改为标准数据库密码校验；`prisma/seed.ts` 管理员密码改为从环境变量 `ADMIN_PASSWORD` 读取并写入 `AdminConfig` 表；全项目 `ffffff` 零残留。 | 安全修复 |
| 2026-04-24 | 项目 GitHub 上传准备 | 1) .gitignore 排除敏感文件（内部文档、AI配置、sysfiles/、data/、node_modules/等）；2) 创建 GitHub 私有仓库（后改为公开） tomcatmartion/navicauseffect；3) 初始提交 401 文件推送成功。 | 部署   |
| 2026-04-19 | 三层混合打标系统 | 实现知识库 chunk 的三层混合打标：1) tag-rules.json 定义 10 个业务标签体系；2) 管理后台可手动指定文件标签（覆盖规则）；3) AI 批量打标（MiniMax，每批 15 段，返回 1-3 标签，失败回退关键词匹配）；新增标签编辑弹窗、重新打标按钮（不重算向量）；向量化时自动集成 AI 打标。测试命中率 100%。 | 新增   |
| 2026-04-19 | 管理后台知识库管理 + RAG 检索测试 | 新增知识库管理页（上传 md/docx/pdf/xlsx、文件列表、向量化进度展示、分段详情查看）；新增 RAG 检索测试页（检索词生成、RAG 结果展示、System Prompt 预览、完整 Messages 展示）；扩展文件解析器支持 PDF/Excel；重构 logicdoc-indexer 支持新格式+进度跟踪；提取 chart-context.ts 共享模块。 | 新增   |
| 2026-04-19 | Chat API 流年/小限数据准确性修复 | 修复 chat API 中流年/小限数据标注错误（当前年数据被标为目标年）和一般问题缺失流年/小限数据的问题；提取 buildChartContext 为共享模块消除重复代码；修复 currentYear 硬编码 2026。 | 修复   |
| 2026-04-08 | logicdoc 单维索引 + RAG 自测 | 修复仅配 1536（如 MiniMax）时索引脚本因缺 1024 配置整次失败、Zvec 无向量导致全模块「无匹配片段」：`runLogicdocZvecIndex` 按已配置维度分别写入并跳过未配维；无结果提示补充单维索引说明；`npm run test:rag-categories` 对 7 个 `AnalysisCategory` 校验 `retrieveLogicdocForAnalysis`。 | 修复   |
| 2026-04-08 | Embedding 解析与后台可维护性 | 修复「HTTP 200 但无向量」：请求默认带 `encoding_format=float`、解析多形态 JSON（含 `output.embeddings`、base64 float32）、Base URL 自动避免重复 `/embeddings`；检索/建库校验向量维与 Zvec 一致；`POST /api/admin/embedding-config/test` + 后台「测试连接」；超时与 `EMBEDDING_OMIT_ENCODING_FORMAT` 可配。 | 优化   |
| 2026-04-08 | MiniMax 式 `vectors` / `base_resp` | 解析 `vectors` 二维数组（及元素内 `embedding`/`vector`）、顶层 `vector`；`base_resp.status_code !== 0` 时抛出业务错误；Embedding 页文案说明。 | 修复   |
| 2026-04-08 | MiniMax 请求体 `texts`+`type` | 检测 minimax 域名时 POST `{ model, texts:[], type: db|query }`；索引用 db、RAG/测试用 query；`EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY` 可强制 OpenAI `input`。 | 修复   |
| 2026-04-08 | Embedding 错误与自测闭环 | `embedding-errors` 增强 base_resp/OpenAI 报错（含 insufficient balance 计费说明）；空输入拦截；HTTP 非 2xx 先解析 `base_resp`；可选 `EMBEDDING_MINIMAX_GROUP_ID`→`group_id`；`isMinimaxEmbeddingBaseUrl` 避免 eslint hook 误报；`npm run test:embedding-pipeline`；后台计费提示与多行错误展示。 | 优化   |
| 2026-04-08 | Embedding 后台 Group ID | `AdminConfig` JSON 存 `groupId`；GET/PUT 与 `readPrev` 合并；MiniMax 请求体 `group_id` 优先用后台、其次 `EMBEDDING_MINIMAX_GROUP_ID` / `EMBEDDING_1536_GROUP_ID`；Embedding 页两维度输入框；`invalid params` 文案指向 Group ID。 | 新增   |
| 2026-03-28 | Embedding PUT 部分保存与字段合并 | 原 `parseDim` 要求单次提交两套均含 baseUrl+modelId，仅填 1536 或漏填 Model ID 时整包 400、库不入账。改为空字段与库旧值合并，按维度独立 upsert（整套齐全才写），可只存一套；页头说明与 400 文案同步。 | 修复   |
| 2026-03-28 | Embedding 后台配置持久化与回读 | 数据存 MySQL `admin_config`（`embedding_config_dim1536` / `dim1024`）。修复 PUT 合并旧 API Key 时误用 `typeof configValue === 'object'`（Json 以字符串返回时读不到旧 Key）；`getEmbeddingConfigStoredShape` 识别 `JsonNull`；PUT 事务写入后回传 `dim1536`/`dim1024` 快照；前端 GET 加时间戳防缓存、保存后用响应更新 state 且静默二次拉取。 | 修复   |
| 2026-03-28 | logicdoc Zvec 双索引 + RAG 解盘 | 两套 Zvec（1536/1024）+ AdminConfig embedding 与 `/admin/embedding`；分块硬提取 stars/palaces/庙旺利陷/时限 + `content_hash` 增量；文件锁单线程索引；`/api/analysis` 按 provider 选维检索，无索引 503；`npm run logicdoc:index-zvec` 与后台重建接口。 | 新增   |
| 2026-03-28 | RAG 与模型映射评审补强 | Provider→1536/1024 显式清单（含 doubao/ark/volcengine）；检索 query 增加运限结构化摘要、`body.userQuestion`；registry 增加「运势」标签与 FORTUNE 过滤；分块注释对齐递归分割策略 + `LOGICDOC_CHUNK_OVERLAP_RATIO`；后台模型增加 OpenAI/Google/豆包并用 OpenAI 兼容 chat。 | 优化   |
| 2026-04-02 | 命盘页左右分栏 + AI 对话功能 | 命盘页改为 PC 左右分栏（左命盘 45%/右 AI 55%），移动端上下堆叠；新增 AI 多轮对话功能（ChatPanel + /api/analysis/chat），SSE 流式输出，前端 State 管理上下文；TypeScript + Build 零错误。 | 新增   |
| 2026-04-02 | Google Fonts 替换为本地字体 | 下载 Noto Serif SC + Noto Sans SC woff2 到 public/fonts/，layout.tsx 改用 next/font/local，构建不再依赖外网。 | 优化   |
| 2026-04-02 | 全面代码审查与文档体系重建 | 审查全部核心代码（API 路由、组件、lib、中间件、Prisma schema）；TypeScript 编译零错误；发现构建因 Google Fonts 网络问题失败（非代码问题）；重建 workresultdoc/CONTEXT/CLAUDE.md/imemory.md/claude.me 五文档体系。 | 优化   |
| 2026-03-28 | MiniMax 提供商（仅后台配置） | 新增 `minimax` Provider（OpenAI 兼容 `https://api.minimaxi.com/v1`）；`/admin/models` 选厂商并填 Key；移除 seed/.env 注入 MiniMax。 | 新增   |
| 2026-03-28 | Prompt 后台与前台浮窗 | AdminConfig `ai_prompts` 可编辑 system + 7 类模块文案（`/admin/prompts`）；解盘接口合并默认；流式首帧 `naviMeta` + 缓存 JSON `promptMessages`；命盘页弹窗展示本次完整 prompt。 | 新增   |
| 2026-03-28 | 登录后 session 被清空修复 | JWT callback 在 Edge（middleware）中不再调用 Prisma；避免解码失败清空 cookie、登录成功却无法进 `/admin`/`/profile`。`npm run test:auth` 已通过。 | 修复   |
| 2026-03-28 | AI 解盘全文输出      | 取消流式/存档的会员预览截断，SSE 全量转发；`previewContent` 与全文一致；分类 prompt 去掉 800–1200 字上限、改为充分展开；默认 `ANALYSIS_MAX_OUTPUT_TOKENS` 提至 16384。 | 优化   |
| 2026-03-25 | 紫微斗数规则解析引擎 | 本地 TypeScript 实现的 ZiweiEngine（格局识别、宫位能级、性格分析、互动关系、事项分析、完整解盘）；`/api/ziwei/analyze` 路由；命盘页新增「规则解析」Tab。 | 新增   |
| 2025-03-07 | workresultdoc 格式   | 表格按日期倒序排列，分隔线与列宽统一，字段说明保留；补全本会话及历史可溯源功能记录。                                                          | 优化   |
| 2025-03-07 | 规则与文档体系       | 新增 workresultdoc.md、CLAUDE.md 工作规范与三文档配合说明、.cursor/rules 交付与复盘规则。                                                     | 新增   |
| 2025-03-07 | 管理功能与权限控制   | 前端 8 个模块（第 8 个「见真连线」弹窗「咨询师下班了」）；后台收费模块管理 /admin/modules；VIP 名单从 AdminConfig 读取。                        | 新增   |
| 2025-03-07 | VIP 专项与付费提示   | 后台可配置 VIP 名单；未付费用户点击 VIP 模块 403，提示升级或单次付费；单次付费用 bonusQueries 扣减。                                           | 优化   |
| 2025-03-07 | 命盘解析存档         | ConsultationRecord 增加 chartFingerprint；同一用户同一命盘同一模块先查存档，命中直接返回不调 AI；新解析结果写入 DB。                           | 新增   |
| 2025-03-05 | 方案B 双 Fork 集成   | 清空既有 iztro 依赖，克隆 iztro + react-iztro 至 packages/，根项目 file: + overrides 单实例；chart 页接回 Iztrolabe，SSR/React19 兼容。          | 新增   |
| 2025-03-04 | Alpha 首版实现       | 命理排盘与命盘展示（iztro 接入）、AI 智能解析 7 模块与限流、会员体系与定价、微信/支付宝支付与回调、手机/微信/邮箱登录、推广分享与积分、管理后台（模型/用户/短信/支付/价格/统计）。 | 新增   |

---

## 字段说明

- **日期**：YYYY-mm-dd，以交付日为准。
- **功能名称**：简短功能标题。
- **功能实现简述**：一两句话概括实现要点（不替代详细设计文档）。
- **状态**：`新增` / `优化` / `升级` / `修复`。

## 更新约定

在每完成一个可交付功能（新增/优化/升级/修复）并交付给用户后，**在同一轮对话中**向本文件追加一行表格记录；若用户明确要求「本次不记」则可不追加。
