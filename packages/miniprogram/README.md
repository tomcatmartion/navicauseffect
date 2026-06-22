# 紫微问道 · 微信小程序（Taro）

> 本目录是「紫微问道」微信小程序工程骨架，独立于主 Next.js 项目。
> 设计参照 `testUI/miniprogram/SPEC.md`，复用同源后端 API。

## 一、快速开始

```bash
cd packages/miniprogram

# 1. 安装依赖（pnpm workspace 已配置，根目录执行亦可）
pnpm install

# 2. 开发模式（监听 + 微信开发者工具打开 ./dist 预览）
pnpm dev:weapp

# 3. 生产构建
pnpm build:weapp
```

构建后用「微信开发者工具」打开 `packages/miniprogram` 目录（含 `project.config.json`），
AppID 默认 `touristappid`（游客模式可预览基础结构，正式发布需替换为真实 AppID）。

## 二、目录结构

```
packages/miniprogram/
├── project.config.json      # 微信开发者工具配置
├── config/                  # Taro 构建配置
│   ├── index.ts             # 主配置
│   ├── dev.ts               # 开发环境（API_BASE=dev.ziwei.app）
│   └── prod.ts              # 生产环境（API_BASE=ziwei.app）
└── src/
    ├── app.ts               # 入口
    ├── app.config.ts        # 页面注册 + tabBar
    ├── app.scss             # 全局样式（复用 testUI newspaper 主题变量）
    ├── services/
    │   ├── api.ts           # Taro.request 封装（等价 H5 api-client）
    │   └── chat-stream.ts   # WebSocket 实现（替代 H5 SSE）
    └── pages/
        ├── index/           # 首页（登录态切换）
        ├── chat/            # AI 对话（命盘抽屉 + WebSocket 流式）
        ├── charts/          # 命盘列表
        ├── reports/         # 报告列表
        └── profile/         # 个人中心（含微信支付 + 分享）
```

## 三、关键改造点（vs H5 端）

详见 `testUI/miniprogram/SPEC.md` §3，本工程已落地：

### 3.1 SSE → HTTP 长轮询（已实现）
小程序不支持 `EventSource` 与 `fetch + ReadableStream`（SSE 不可用）。AI 对话改用 **HTTP 长轮询**：
- 客户端：`src/services/chat-stream.ts` 的 `openChatStream()`（POST 启动 + 每 600ms GET 轮询）
- 后端：`POST /api/ziwei/reading-poll` 启动后台 AI 流（复用 `runHybridPipeline`）+ Redis stream 缓存
- 后端：`GET /api/ziwei/reading-poll?sessionId=&offset=` 返回 `{items, nextOffset, done}`
- 不引入 custom server / WebSocket，部署方式不变

### 3.2 微信支付（已实现）
小程序支付不能用 H5 JSSDK，必须用 `wx.requestPayment`：
- 客户端：`src/services/api.ts` 的 `requestPayment(planId)` 已封装
- 后端：`POST /api/payment/wx-minipay` 返回签名参数（timeStamp/nonceStr/package/paySign/signType）
- **当前为 mock 模式**（默认）：未配置微信支付 V3 凭证时返回 fake 签名，订单仍真实创建为 PENDING
- 真实模式：配置 `WECHAT_PAY_MCH_ID` + `WECHAT_PAY_API_V3_KEY` + `WECHAT_PAY_CERT_SERIAL_NO` + `WECHAT_PAY_PRIVATE_KEY_PEM` 后自动切换

### 3.3 分享
小程序分享必须用 `<Button open-type="share">` 或 `Page.onShareAppMessage`：
- profile 页已用 `Taro.useShareAppMessage` 定义分享内容
- 分享得币逻辑：好友通过分享链接进入并注册 → 后端记录 → 调用方获星币

## 四、后端 API（已全部实现）

以下 API 已在主项目（navicauseffect_v2）中实现，小程序可直接调用：

| 接口 | 用途 | 状态 |
|---|---|---|
| `POST /api/auth/wechat-miniprogram` | 微信 code → JWT token | ✅ 已实现（mock/真实双模） |
| `POST + GET /api/ziwei/reading-poll` | HTTP 长轮询 AI 对话流 | ✅ 已实现（复用 SSE 内核） |
| `POST /api/payment/wx-minipay` | 微信小程序支付签名 | ✅ 已实现（mock/真实双模） |
| `GET /api/user/profile` 字段对齐 | 含 `name`/`chartCount` | ✅ 已实现（支持 Bearer JWT） |

**认证方式**：小程序登录后拿到 JWT，存 `Taro.setStorageSync("auth_token", token)`，后续请求自动加 `Authorization: Bearer <token>` 头部（`src/services/api.ts` 已封装）。与 H5 NextAuth session 完全独立。

**mock 模式默认开启**：未配置微信凭证时所有 API 仍可独立测试，配置后通过环境变量切换到真实模式（代码零改动）。

## 五、设计 token 复用

`src/app.scss` 顶部定义了 testUI 报纸主题变量（与 H5 端 `src/styles/ziwei/ziwei.css` 同源），
小程序暂不支持粘土/新拟态主题切换（首版简化，见 SPEC.md）。

## 六、与主项目的协作

- **后端 API 完全复用**：所有请求走 `https://ziwei.app/api/*`，与 H5 端共用
- **认证体系独立**：小程序有自己的微信登录链路，不与 H5 NextAuth session 共享 cookie
- **数据隔离**：小程序用户与 H5 用户通过 `wechatOpenId` 关联，后端 User 表已支持

## 七、版本

- Taro: 4.0.9
- React: 18
- 兼容基础库：2.10.0+
