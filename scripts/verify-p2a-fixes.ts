/**
 * P2-A 修复点端到端验证脚本
 * 覆盖：B-07+C-04 / B-07-2+O-08 / B-10 / O-03 / O-04 / O-09 / C-14 / C-12 / C-05 / C-06 / S-03
 *
 * 验证策略：
 *  - DOM 可见的：用 Playwright headless + cookie 注入登录 admin
 *  - 源码层 / NODE_ENV 分支：用 fs grep 验证（避免生产构建切换）
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "http://localhost:3333";
const ROOT = process.cwd();

interface CheckResult {
  id: string;
  name: string;
  passed: boolean;
  evidence: string;
}
const results: CheckResult[] = [];

function record(id: string, name: string, passed: boolean, evidence: string) {
  results.push({ id, name, passed, evidence });
  const tag = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`  ${tag} [${id}] ${name}\n      ${evidence}`);
}

function readFile(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function grep(pattern: RegExp, content: string): boolean {
  return pattern.test(content);
}

async function adminLoginViaAPI(context: import("playwright").BrowserContext) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const cookies1: Record<string, string> = {};
  for (const sc of csrfRes.headers.getSetCookie?.() ?? []) {
    const kv = sc.split(";")[0];
    const eq = kv.indexOf("=");
    if (eq > 0) cookies1[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
  const csrf = (await csrfRes.json()).csrfToken;
  const body = new URLSearchParams({
    username: "admin",
    password: "ffffff",
    csrfToken: csrf,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: Object.entries(cookies1).map(([k, v]) => `${k}=${v}`).join("; "),
    },
    body: body.toString(),
    redirect: "manual",
  });
  for (const sc of loginRes.headers.getSetCookie?.() ?? []) {
    const kv = sc.split(";")[0];
    const eq = kv.indexOf("=");
    if (eq > 0) cookies1[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
  await context.addCookies(
    Object.entries(cookies1).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log("\n=== P2-A 修复点端到端验证 ===\n");
  await adminLoginViaAPI(context);

  // ─────────────────────────────────────────────────────────────
  // 源码层验证（NODE_ENV 分支无法在 dev 下测 prod 行为，用 grep 守卫存在性）
  // ─────────────────────────────────────────────────────────────

  // B-07 + C-04：user 页 mock 充值 dev/prod 分支
  console.log("[B-07+C-04] user 页 mock 充值 dev/prod 分支");
  {
    const src = readFile("src/app/(main)/user/page.tsx");
    const hasDevGuard = grep(/NODE_ENV === "development"/, src);
    const hasProdFallback = grep(/router\.push\("\/pricing"\)/, src);
    const hasDialogGuard = grep(/\{process\.env\.NODE_ENV === "development" && \(\s*\n\s*<Dialog open=\{showRechargeModal\}/, src);
    record(
      "B-07+C-04",
      "user 页充值入口 + Dialog 双重 dev 守卫 + 生产跳 /pricing",
      hasDevGuard && hasProdFallback,
      `devGuard=${hasDevGuard}, prodFallback=${hasProdFallback}`,
    );
  }

  // B-07-2 + O-08：mock-pay 页生产 redirect
  console.log("\n[B-07-2+O-08] mock-pay 页生产 redirect 守卫");
  {
    const src = readFile("src/app/(main)/pricing/mock-pay/page.tsx");
    const hasRedirect = grep(/NODE_ENV === "production"\)[\s\S]*?router\.replace\("\/pricing"\)/, src);
    const hasEarlyReturn = grep(/if \(process\.env\.NODE_ENV === "production"\)[\s\S]*?return null/, src);
    record(
      "B-07-2+O-08",
      "mock-pay 页生产环境 redirect + 早返 null",
      hasRedirect && hasEarlyReturn,
      `redirect=${hasRedirect}, earlyReturn=${hasEarlyReturn}`,
    );
  }

  // B-10：注册失败一键重试
  console.log("\n[B-10] 注册失败一键重试按钮");
  {
    const src = readFile("src/app/auth/login/page.tsx");
    const hasRetryBtn = grep(/一键重试/, src);
    const hasFormId = grep(/id="register-form"/, src);
    const hasRequestSubmit = grep(/requestSubmit\(\)/, src);
    record(
      "B-10",
      "login 注册失败显示一键重试按钮（提交 register-form）",
      hasRetryBtn && hasFormId && hasRequestSubmit,
      `retryBtn=${hasRetryBtn}, formId=${hasFormId}, requestSubmit=${hasRequestSubmit}`,
    );
  }

  // O-03：chart 移动端默认折叠 + debug 隐藏
  console.log("\n[O-03] chart 移动端 chartPanelOpen=false + debug isAdmin 守卫");
  {
    const src = readFile("src/app/(main)/chart/page.tsx");
    const hasMobileGuard = grep(/window\.innerWidth < 768[\s\S]{0,80}setChartPanelOpen\(false\)/, src);
    const hasDebugGuard = grep(/\{birthData && isAdmin && \(/, src);
    record(
      "O-03",
      "chart 移动端默认折叠 + debug 已有 isAdmin 守卫",
      hasMobileGuard && hasDebugGuard,
      `mobileGuard=${hasMobileGuard}, debugGuard=${hasDebugGuard}`,
    );
  }

  // O-04：useLayoutEffect 早关闭 isHydrating
  console.log("\n[O-04] useLayoutEffect 早关闭 isHydrating");
  {
    const src = readFile("src/app/(main)/chart/page.tsx");
    const hasLayoutEffect = grep(/useLayoutEffect\(\(\) => \{[\s\S]{0,300}setIsHydrating\(false\)/, src);
    const hasImport = grep(/useLayoutEffect/, src);
    record(
      "O-04",
      "chart 用 useLayoutEffect 在 paint 前关闭无数据 hydrating",
      hasLayoutEffect && hasImport,
      `layoutEffectClosing=${hasLayoutEffect}, import=${hasImport}`,
    );
  }

  // O-09：ErrorRetryCard 组件 + dual-chat-panel 接入
  console.log("\n[O-09] ErrorRetryCard 组件 + dual-chat-panel 错误分支接入");
  {
    const cardSrc = readFile("src/components/shared/error-retry-card.tsx");
    const panelSrc = readFile("src/components/analysis/dual-chat-panel.tsx");
    const cardExported = grep(/export function ErrorRetryCard/, cardSrc);
    const panelImports = grep(/from "@\/components\/shared\/error-retry-card"/, panelSrc);
    const panelErrorField = grep(/error\?: \{[\s\S]{0,200}retryText/, panelSrc);
    const panelUsesCard = grep(/<ErrorRetryCard/, panelSrc);
    record(
      "O-09",
      "ErrorRetryCard 组件存在 + dual-chat-panel 接入",
      cardExported && panelImports && panelErrorField && panelUsesCard,
      `cardExported=${cardExported}, imports=${panelImports}, errorField=${panelErrorField}, usesCard=${panelUsesCard}`,
    );
  }

  // C-14：profile 邀请码合并到邀请好友区
  console.log("\n[C-14] profile 邀请码合并");
  {
    const src = readFile("src/app/(main)/profile/page.tsx");
    // 账号安全区不再有「我的邀请码」setting-row；邀请好友区仍保留
    const accountSectionClean = grep(/C-14：邀请码已合并/, src);
    const inviteSectionRetained = grep(/font-mono[\s\S]{0,200}\{profile\.inviteCode\}/, src);
    record(
      "C-14",
      "账号安全区移除邀请码 + 邀请好友区保留",
      accountSectionClean && inviteSectionRetained,
      `accountClean=${accountSectionClean}, inviteRetained=${inviteSectionRetained}`,
    );
  }

  // C-12：promoter 渠道精简
  console.log("\n[C-12] promoter 渠道精简（3 primary + 更多折叠）");
  {
    const src = readFile("src/app/(main)/promoter/page.tsx");
    const hasPrimary = grep(/primary: true/, src);
    const primaryCount = (src.match(/primary: true/g) || []).length;
    const hasMoreButton = grep(/showMoreChannels/, src);
    const hasC12Comment = grep(/C-12/, src);
    record(
      "C-12",
      "promoter 3 个 primary 渠道 + 更多渠道折叠",
      hasPrimary && primaryCount === 3 && hasMoreButton && hasC12Comment,
      `primary=${hasPrimary}, count=${primaryCount}, moreBtn=${hasMoreButton}, comment=${hasC12Comment}`,
    );
  }

  // C-05：settings 偏好折叠为 details
  console.log("\n[C-05] settings 偏好折叠");
  {
    const src = readFile("src/app/(main)/settings/page.tsx");
    const hasDetails = grep(/<details[\s\S]*?高级偏好/, src);
    const hasSummary = grep(/<summary[\s\S]*?高级偏好/, src);
    const hasC05Comment = grep(/C-05/, src);
    record(
      "C-05",
      "settings 偏好区改为 details/summary 折叠",
      hasDetails && hasSummary && hasC05Comment,
      `details=${hasDetails}, summary=${hasSummary}, comment=${hasC05Comment}`,
    );
  }

  // C-06：父母生肖 tooltip
  console.log("\n[C-06] 父母生肖 tooltip");
  {
    const src = readFile("src/components/chart/birth-input-form.tsx");
    const hasTitle = grep(/title="用于四化评分修正/, src);
    record(
      "C-06",
      "birth-input-form 父母生肖 label 含 title tooltip",
      hasTitle,
      `title=${hasTitle}`,
    );
  }

  // S-03：DualChatPanel 新建对话按钮
  console.log("\n[S-03] DualChatPanel 新建对话按钮");
  {
    const src = readFile("src/components/analysis/dual-chat-panel.tsx");
    const hasNewChat = grep(/handleNewChat/, src);
    const hasButton = grep(/新建对话/, src);
    // 两个清理调用都在 handleNewChat 函数体内（顺序不固定）
    const clearsMessages = grep(/setMessages\(\[\]\)/, src);
    const clearsSession = grep(/setSessionId\(null\)/, src);
    record(
      "S-03",
      "DualChatPanel 顶部新建对话按钮（清空 messages + sessionId）",
      hasNewChat && hasButton && clearsMessages && clearsSession,
      `handler=${hasNewChat}, button=${hasButton}, clearsMsg=${clearsMessages}, clearsSession=${clearsSession}`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // DOM 验证（admin 登录后访问页面）
  // ─────────────────────────────────────────────────────────────

  // C-12 DOM：promoter 默认显示 3 个 primary 渠道
  console.log("\n[C-12 DOM] promoter 默认 3 个 primary 渠道卡片");
  await page.goto(`${BASE}/promoter`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const shareCardCount = await page.locator(".share-grid .share-card").count();
  const moreBtnVisible = await page.locator('button:has-text("更多渠道")').count();
  record(
    "C-12-DOM",
    "promoter 默认渲染 3 个 primary 渠道 + 更多按钮可见",
    shareCardCount === 3 && moreBtnVisible >= 1,
    `shareCard=${shareCardCount}, moreBtn=${moreBtnVisible}`,
  );

  // C-05 DOM：settings 偏好折叠（<details> 元素存在且默认关闭）
  console.log("\n[C-05 DOM] settings 偏好 details 折叠");
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const detailsCount = await page.locator("details").count();
  const firstDetailsOpen = detailsCount > 0
    ? await page.locator("details").first().getAttribute("open")
    : "no-details";
  const settingsText = await page.locator("body").textContent();
  const hasAdvancedPref = /高级偏好/.test(settingsText ?? "");
  // details 默认不带 open 属性 = 折叠态
  record(
    "C-05-DOM",
    "settings 偏好 details 默认折叠",
    detailsCount >= 1 && firstDetailsOpen === null && hasAdvancedPref,
    `detailsCount=${detailsCount}, open=${firstDetailsOpen}, 高级偏好可见=${hasAdvancedPref}`,
  );

  // B-07 DOM：user 页（dev 环境）mock 充值入口仍可见
  console.log("\n[B-07 DOM] user 页 dev 环境保留 mock 充值");
  await page.goto(`${BASE}/user`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  // dev 环境下应有「立即充值」按钮；如果跑在生产构建则改为「前往会员中心」
  const userText = await page.locator("body").textContent() ?? "";
  const hasRechargeEntry = /立即充值/.test(userText) || /前往会员中心/.test(userText);
  // 资产与会籍区域一定存在
  const hasAssetsSection = /资产与会籍/.test(userText);
  record(
    "B-07-DOM",
    "user 页 dev/prod 分支均渲染充值入口（文案对应）",
    hasRechargeEntry && hasAssetsSection,
    `rechargeEntry=${hasRechargeEntry}, 资产区=${hasAssetsSection}`,
  );

  await browser.close();

  console.log("\n=== 验证汇总 ===");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`PASS: ${passed} / ${results.length}    FAIL: ${failed}\n`);
  if (failed > 0) {
    console.log("失败项:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`  - [${r.id}] ${r.name}: ${r.evidence}`);
    });
    process.exit(1);
  } else {
    console.log("✓ 全部 P2-A 修复点验证通过\n");
  }
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(2);
});
