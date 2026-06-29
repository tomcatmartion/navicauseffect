/**
 * P3 修复点验证脚本（B-01 / B-01-2 / B-02 / B-02-2 / B-17）
 *
 * 覆盖 5 个新建后端 API + 3 处前端接入：
 *   - POST /api/auth/send-reset-code（B-01）
 *   - POST /api/auth/forgot-password（B-01）
 *   - POST /api/auth/change-password（B-01-2）
 *   - POST /api/auth/wechat/bind（B-02）
 *   - POST /api/auth/wechat/unbind（B-02-2）
 *   - B-17 客户端检查扩展到 reports/compatibility/chart（hook + 3 处接入）
 *   - Loading 组件收敛（视觉一致，分工说明）
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

  console.log("\n=== P3 修复点端到端验证 ===\n");

  // ─────────────────────────────────────────────────────────────
  // 源码层验证
  // ─────────────────────────────────────────────────────────────

  // B-01：重置密码 API + 前端调用
  console.log("[B-01] 重置密码 API（send-reset-code + forgot-password）");
  {
    const sendApi = readFile("src/app/api/auth/send-reset-code/route.ts");
    const resetApi = readFile("src/app/api/auth/forgot-password/route.ts");
    const front = readFile("src/app/auth/forgot-password/page.tsx");
    const hasSend = grep(/sendCode\(phone\)/, sendApi);
    const hasReset = grep(/verifyCode\(phone, code\)[\s\S]{0,500}bcrypt\.hash\(newPassword/, resetApi);
    const hasUserCheck = grep(/findFirst\(\{[\s\S]{0,100}where: \{ phone \}/, sendApi);
    const frontCallsSend = grep(/fetch\("\/api\/auth\/send-reset-code"/, front);
    const frontCallsReset = grep(/fetch\("\/api\/auth\/forgot-password"/, front);
    record(
      "B-01",
      "send-reset-code（含已注册校验）+ forgot-password（verifyCode + bcrypt）+ 前端调用",
      hasSend && hasReset && hasUserCheck && frontCallsSend && frontCallsReset,
      `send=${hasSend}, reset=${hasReset}, userCheck=${hasUserCheck}, frontSend=${frontCallsSend}, frontReset=${frontCallsReset}`,
    );
  }

  // B-01-2：修改密码 API
  console.log("\n[B-01-2] 修改密码 API（change-password）");
  {
    const api = readFile("src/app/api/auth/change-password/route.ts");
    const front = readFile("src/app/auth/change-password/page.tsx");
    const hasAuth = grep(/auth\(\)[\s\S]{0,200}session\?\.user\?\.id/, api);
    const hasBcrypt = grep(/bcrypt\.compare\(oldPassword[\s\S]{0,200}bcrypt\.hash\(newPassword/, api);
    const hasNoPassword = grep(/NO_PASSWORD_SET/, api);
    const frontCalls = grep(/fetch\("\/api\/auth\/change-password"/, front);
    record(
      "B-01-2",
      "change-password（鉴权 + bcrypt.compare + hash + NO_PASSWORD_SET 兜底）+ 前端调用",
      hasAuth && hasBcrypt && hasNoPassword && frontCalls,
      `auth=${hasAuth}, bcrypt=${hasBcrypt}, noPwdSet=${hasNoPassword}, front=${frontCalls}`,
    );
  }

  // B-02 / B-02-2：微信绑定 + 解绑
  console.log("\n[B-02/B-02-2] 微信绑定 + 解绑 API");
  {
    const bindApi = readFile("src/app/api/auth/wechat/bind/route.ts");
    const unbindApi = readFile("src/app/api/auth/wechat/unbind/route.ts");
    const frontBind = readFile("src/app/auth/bind-wechat/page.tsx");
    const profileSrc = readFile("src/app/(main)/profile/page.tsx");
    const hasBindAuth = grep(/auth\(\)[\s\S]{0,200}session\?\.user\?\.id/, bindApi);
    const hasBindOAuth = grep(/sns\/oauth2\/access_token/, bindApi);
    const hasBindMock = grep(/mock_\$\{userId\}/, bindApi);
    const hasBindCheck = grep(/wechatOpenId: openid[\s\S]{0,500}existingUser/, bindApi);
    const hasUnbindGuard = grep(/!user\.phone && !user\.password/, unbindApi);
    const frontBindCalls = grep(/fetch\("\/api\/auth\/wechat\/bind"/, frontBind);
    const profileUnbindCalls = grep(/fetch\("\/api\/auth\/wechat\/unbind"/, profileSrc);
    record(
      "B-02/B-02-2",
      "bind（鉴权 + OAuth + mock + 占用校验）+ unbind（解绑后登录方式校验）+ 前端调用",
      hasBindAuth && hasBindOAuth && hasBindMock && hasBindCheck && hasUnbindGuard && frontBindCalls && profileUnbindCalls,
      `bindAuth=${hasBindAuth}, oauth=${hasBindOAuth}, mock=${hasBindMock}, check=${hasBindCheck}, unbindGuard=${hasUnbindGuard}, frontBind=${frontBindCalls}, profileUnbind=${profileUnbindCalls}`,
    );
  }

  // B-17：客户端检查扩展
  console.log("\n[B-17] 客户端 phoneBindingRequired 检查扩展");
  {
    const hook = readFile("src/lib/auth/use-require-phone-binding.ts");
    const reports = readFile("src/app/(main)/reports/page.tsx");
    const compat = readFile("src/app/(main)/compatibility/page.tsx");
    const panel = readFile("src/components/analysis/dual-chat-panel.tsx");
    const hasHook = grep(/export function useRequirePhoneBinding/, hook);
    const reportsUses = grep(/requirePhoneBinding\(\)/, reports);
    const compatUses = grep(/requirePhoneBinding\(\)/, compat);
    const panelUses = grep(/requirePhoneBinding\(\)/, panel);
    record(
      "B-17",
      "useRequirePhoneBinding hook + 3 处接入（reports/compatibility/dual-chat-panel）",
      hasHook && reportsUses && compatUses && panelUses,
      `hook=${hasHook}, reports=${reportsUses}, compat=${compatUses}, panel=${panelUses}`,
    );
  }

  // S-02：Loading 收敛（视觉一致，分工说明）
  console.log("\n[S-02] Loading 组件收敛（分工说明 + 视觉一致）");
  {
    const ls = readFile("src/components/shared/loading-state.tsx");
    const lsk = readFile("src/components/shared/loading-skeleton.tsx");
    const hasDivision = grep(/LoadingState[\s\S]{0,200}页面级[\s\S]{0,200}LoadingSkeleton[\s\S]{0,200}区块级/, ls);
    const sameIcon = grep(/ti ti-loader-2 ti-spin/, ls) && grep(/ti ti-loader-2 ti-spin/, lsk);
    record(
      "S-02",
      "LoadingState 与 LoadingSkeleton 分工说明 + 视觉一致（同 ti-loader-2）",
      hasDivision && sameIcon,
      `division=${hasDivision}, sameIcon=${sameIcon}`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // API 烟雾测试
  // ─────────────────────────────────────────────────────────────

  console.log("\n[B-01 API] send-reset-code 烟雾测试");
  const sendRes = await fetch(`${BASE}/api/auth/send-reset-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "13800138000" }),
  });
  const sendData = await sendRes.json();
  record(
    "B-01-API",
    "send-reset-code 返回 200 + mock hint",
    sendRes.status === 200 && sendData.mock === true,
    `status=${sendRes.status}, mock=${sendData.mock}, hint=${sendData.hint}`,
  );

  console.log("\n[B-01 API] forgot-password 烟雾测试（未注册手机号 → 验证码错误）");
  const resetRes = await fetch(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "13800138000", code: "123456", newPassword: "testpass123" }),
  });
  const resetData = await resetRes.json();
  record(
    "B-01-API-2",
    "forgot-password 对未注册手机号返回 400（验证码错误，安全策略生效）",
    resetRes.status === 400 && /验证码错误/.test(resetData.error),
    `status=${resetRes.status}, error="${resetData.error}"`,
  );

  console.log("\n[B-01-2 API] change-password 未登录鉴权");
  const cpRes = await fetch(`${BASE}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPassword: "x", newPassword: "newpass123" }),
  });
  record(
    "B-01-2-API",
    "change-password 未登录返回 401",
    cpRes.status === 401,
    `status=${cpRes.status}`,
  );

  console.log("\n[B-02 API] wechat/bind 未登录鉴权");
  const wbRes = await fetch(`${BASE}/api/auth/wechat/bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "MOCK" }),
  });
  record(
    "B-02-API",
    "wechat/bind 未登录返回 401",
    wbRes.status === 401,
    `status=${wbRes.status}`,
  );

  console.log("\n[B-02-2 API] wechat/unbind 未登录鉴权");
  const wuRes = await fetch(`${BASE}/api/auth/wechat/unbind`, {
    method: "POST",
  });
  record(
    "B-02-2-API",
    "wechat/unbind 未登录返回 401",
    wuRes.status === 401,
    `status=${wuRes.status}`,
  );

  // ─────────────────────────────────────────────────────────────
  // DOM 验证（admin 登录后）
  // ─────────────────────────────────────────────────────────────
  await adminLoginViaAPI(context);

  console.log("\n[DOM] forgot-password 页面真实调用");
  await page.goto(`${BASE}/auth/forgot-password`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const fpText = await page.locator("body").textContent();
  const fpHasRealCall = /验证码将通过短信发送/.test(fpText ?? "");
  const fpNoMock = !/模拟流程，未真实重置/.test(fpText ?? "");
  record("DOM-forgot", "forgot-password 页面无模拟提示 + 真实 API 说明", fpHasRealCall && fpNoMock, `realHint=${fpHasRealCall}, noMock=${fpNoMock}`);

  console.log("\n[DOM] bind-wechat 页面真实 OAuth 入口");
  await page.goto(`${BASE}/auth/bind-wechat`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const bwText = await page.locator("body").textContent();
  const bwHasOAuth = /跳转微信授权|一键绑定/.test(bwText ?? "");
  record("DOM-bind-wechat", "bind-wechat 页面有真实 OAuth 入口或 mock 一键绑定", bwHasOAuth, `entry=${bwHasOAuth}`);

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
    console.log("✓ 全部 P3 修复点验证通过\n");
  }
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(2);
});
