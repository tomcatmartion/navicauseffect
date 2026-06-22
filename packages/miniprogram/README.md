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

### 3.1 SSE → WebSocket
小程序不支持 `EventSource` 与 `fetch + ReadableStream`。AI 对话改用 WebSocket：
- 客户端：`src/services/chat-stream.ts` 用 `Taro.connectSocket`
- 后端需新增 `/api/ziwei/reading-ws` WebSocket 路由（**当前后端未实现**，需另起任务）

### 3.2 微信支付
小程序支付不能用 H5 JSSDK，必须用 `wx.requestPayment`：
- 客户端：`src/services/api.ts` 的 `requestPayment(planId)` 已封装
- 后端需新增 `/api/payment/wx-minipay` 路由返回签名参数（timeStamp/nonceStr/package/paySign）

### 3.3 分享
小程序分享必须用 `<Button open-type="share">` 或 `Page.onShareAppMessage`：
- profile 页已用 `Taro.useShareAppMessage` 定义分享内容
- 分享得币逻辑：好友通过分享链接进入并注册 → 后端记录 → 调用方获星币

## 四、待办（后端配合项）

以下后端 API 尚未实现，需在主项目（navicauseffect_v2）中新增：

| 接口 | 用途 | 优先级 |
|---|---|---|
| `POST /api/auth/wechat-miniprogram` | 微信 code → JWT token | P0 |
| `WS /api/ziwei/reading-ws` | WebSocket AI 对话流 | P0 |
| `POST /api/payment/wx-minipay` | 微信小程序支付签名 | P1 |
| `GET /api/user/profile` 字段对齐 | `chartCount` 等字段 | P1 |

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
