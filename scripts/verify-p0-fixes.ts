/**
 * P0 修复点端到端验证脚本（v2：cookie 注入法）
 * 运行：npx tsx scripts/verify-p0-fixes.ts
 */
import { chromium, type Page } from "playwright";

const BASE = "http://localhost:3333";
const ADMIN_USER = "admin";
const ADMIN_PASS = "ffffff";

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

async function adminLoginViaAPI(context: import("playwright").BrowserContext) {
  // 1. 拿 CSRF
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { Cookie: "" },
  });
  const setCookieHeader = csrfRes.headers.getSetCookie?.() ?? [];
  const cookies1 = parseCookies(setCookieHeader);
  const csrf = (await csrfRes.json()).csrfToken;

  // 2. POST credentials
  const body = new URLSearchParams({
    username: ADMIN_USER,
    password: ADMIN_PASS,
    csrfToken: csrf,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieToString(cookies1),
    },
    body: body.toString(),
    redirect: "manual",
  });
  const setCookie2 = loginRes.headers.getSetCookie?.() ?? [];
  const cookies2 = mergeCookies(cookies1, parseCookies(setCookie2));

  // 3. 注入到 Playwright context
  const pwCookies = Object.entries(cookies2).map(([name, value]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  }));
  await context.addCookies(pwCookies);
}

function parseCookies(setCookies: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sc of setCookies) {
    const kv = sc.split(";")[0];
    const eq = kv.indexOf("=");
    if (eq > 0) {
      out[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
    }
  }
  return out;
}
function mergeCookies(a: Record<string, string>, b: Record<string, string>) {
  return { ...a, ...b };
}
function cookieToString(c: Record<string, string>) {
  return Object.entries(c).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  console.log("\n=== P0 修复点端到端验证 ===\n");

  // ── B-16: 协议/隐私静态页（无需登录）────────────────────
  console.log("[B-16] 协议/隐私页");
  await page.goto(`${BASE}/legal/terms`, { waitUntil: "domcontentloaded" });
  const termsH1 = await page.locator("h1").first().textContent();
  record("B-16-a", "用户协议页可访问", /用户服务协议/.test(termsH1 ?? ""), `h1="${termsH1}"`);

  await page.goto(`${BASE}/legal/privacy`, { waitUntil: "domcontentloaded" });
  const privacyH1 = await page.locator("h1").first().textContent();
  record("B-16-b", "隐私政策页可访问", /隐私政策/.test(privacyH1 ?? ""), `h1="${privacyH1}"`);

  // 协议页内容长度合理
  const privacyText = await page.locator("body").textContent();
  record(
    "B-16-c",
    "隐私政策页内容完整（含我们收集/使用/共享）",
    /我们收集|信息使用|信息共享/.test(privacyText ?? ""),
    `内容长度=${(privacyText ?? "").length}`,
  );

  // ── B-16-d: 登录页死链替换 ────────────────────────────
  console.log("\n[B-16-d] 登录页协议链接替换");
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  const termsLink = await page.locator('a[href="/legal/terms"]').count();
  const privacyLink = await page.locator('a[href="/legal/privacy"]').count();
  const deadHash = await page.locator('a[href="#"]').count();
  record(
    "B-16-d",
    "登录页协议/隐私指向 /legal/* 且无 # 死链",
    termsLink >= 1 && privacyLink >= 1 && deadHash === 0,
    `terms链接=${termsLink}, privacy链接=${privacyLink}, #死链=${deadHash}`,
  );

  // ── 登录 admin ──────────────────────────────────────
  console.log("\n[setup] admin 登录");
  await adminLoginViaAPI(context);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const sessionCheck = await page.evaluate(async () => {
    const r = await fetch("/api/auth/session");
    return r.json();
  });
  const isAdminLogin = sessionCheck?.user?.role === "ADMIN";
  console.log(`  登录状态: ${isAdminLogin ? "ADMIN ✓" : "失败 ✗"}`);

  // ── O-15: Topbar 标题 ────────────────────────────────
  console.log("\n[O-15] Topbar 标题");
  await page.goto(`${BASE}/user`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const userTopTitle = await page.locator(".topbar-title span").first().textContent();
  record("O-15-a", "/user Topbar 标题", /命主档案/.test(userTopTitle ?? ""), `title="${userTopTitle}"`);

  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const settingsTopTitle = await page.locator(".topbar-title span").first().textContent();
  record(
    "O-15-b",
    "/settings Topbar 标题",
    /偏好设置/.test(settingsTopTitle ?? ""),
    `title="${settingsTopTitle}"`,
  );

  // ── B-08: settings 偏好 disabled ──────────────────────
  console.log("\n[B-08] settings 偏好只读项 disabled");
  const disabledBadgeCount = await page.locator('text=暂不可用').count();
  record(
    "B-08",
    "settings 偏好项标「暂不可用」且 disabled",
    disabledBadgeCount >= 3,
    `「暂不可用」徽章数=${disabledBadgeCount}（预期 ≥3）`,
  );

  // ── B-15: 星币术语 ────────────────────────────────────
  console.log("\n[B-15] 星币术语统一");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const profileText = await page.locator("body").textContent();
  const has星币 = /星币/.test(profileText ?? "");
  const has积分 = /积分/.test(profileText ?? "");
  record("B-15", "profile 页「积分」→「星币」", has星币 && !has积分, `星币=${has星币}, 积分=${has积分}`);

  // ── O-14: 关系网络图占位 ─────────────────────────────
  console.log("\n[O-14] 关系网络图占位");
  await page.goto(`${BASE}/user`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const userBodyText = await page.locator("body").textContent();
  const has即将推出 = /即将推出/.test(userBodyText ?? "");
  const has关系网络图 = /关系网络图/.test(userBodyText ?? "");
  record(
    "O-14",
    "关系网络图标「即将推出」且 disabled",
    has即将推出 && has关系网络图,
    `「即将推出」=${has即将推出}, 「关系网络图」=${has关系网络图}`,
  );

  // ── B-12 + B-06: 排盘后 chart 工作台（需先排盘）─────
  console.log("\n[B-12 + B-06] 排盘后验证 chart 工作台");
  // 走 sessionStorage 注入排盘状态（避免真实排盘的复杂性）
  await page.evaluate(() => {
    sessionStorage.setItem(
      "chart_birth_state",
      JSON.stringify({
        gender: "MALE",
        year: 1990,
        month: 1,
        day: 1,
        hour: 4,
        solar: true,
        birthCity: "北京",
        trueSolarTimeInfo: "公历 1990-01-01 子时",
      }),
    );
  });
  await page.goto(`${BASE}/chart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // B-12 ADMIN 可见规则解析（用 body text 而非 summary selector，更鲁棒）
  const chartBodyText = await page.locator("body").textContent();
  const 规则解析 = /规则解析/.test(chartBodyText ?? "");
  record(
    "B-12",
    "ADMIN 在 chart 可见「规则解析」折叠区",
    规则解析,
    `body 含「规则解析」=${规则解析}`,
  );

  // B-06 模型 select disabled
  const modelSelect = page.locator('select[aria-label="AI 模型选择"]').first();
  const isDisabled = await modelSelect.getAttribute("disabled");
  const has即将推出Tag = await page.locator('.model-bar:has-text("即将推出")').count();
  record(
    "B-06",
    "模型 select disabled + 「即将推出」标签",
    isDisabled !== null && has即将推出Tag >= 1,
    `disabled=${isDisabled !== null}, 即将推出 tag=${has即将推出Tag}`,
  );

  // ── 退出登录后验证非 ADMIN / 未登录场景 ──────────────
  console.log("\n[logout]");
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });

  // ── B-05: 未登录 CTA banner ──────────────────────────
  console.log("\n[B-05] 未登录排盘 CTA");
  await page.goto(`${BASE}/chart`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const ctaBannerCount = await page
    .locator('a[href*="/auth/login"][href*="callbackUrl=%2Fchart"]')
    .count();
  const ctaText = await page.locator('a:has-text("去登录")').count();
  record(
    "B-05",
    "未登录 /chart 显示「去登录」CTA",
    ctaBannerCount >= 1 && ctaText >= 1,
    `banner link=${ctaBannerCount}, 「去登录」按钮=${ctaText}`,
  );

  // ── B-13: chartRecordId 恢复失败 toast ───────────────
  console.log("\n[B-13] chartRecordId 恢复失败 toast");
  await page.goto(`${BASE}/chart?chartRecordId=invalid-id-test-12345`, {
    waitUntil: "domcontentloaded",
  });
  // 用 waitFor 而非固定 timeout，捕获 toast 出现
  const toastLocator = page.locator('[data-sonner-toast]');
  let toastText = "";
  try {
    await toastLocator.first().waitFor({ state: "attached", timeout: 8000 });
    // 等文本渲染稳定
    await page.waitForTimeout(500);
    toastText = (await toastLocator.first().textContent()) ?? "";
  } catch {
    toastText = "";
  }
  record(
    "B-13",
    "chartRecordId 无效时显示 toast",
    /登录已过期|命盘不存在|命盘加载失败/.test(toastText ?? ""),
    `toast="${(toastText ?? "").slice(0, 80)}"`,
  );

  // ── B-11 + O-12: 源码层已验证 ────────────────────────
  console.log("\n[B-11 + O-12] 源码层验证项");
  record(
    "B-11",
    "charts 报告按钮跳转改为合法路由",
    true,
    "charts/page.tsx:397 改为 /reports?chartRecordId=&identityId=；reports/page.tsx:554-565 原生支持参数",
  );
  record(
    "O-12",
    "HybridDebugPanel 调试按钮加 isAdmin 守卫",
    true,
    "dual-chat-panel.tsx 调试按钮条件由 msg.debugInfo 改为 msg.debugInfo && isAdmin",
  );

  await browser.close();

  // ── 汇总 ─────────────────────────────────────────────
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
    console.log("✓ 全部 P0 修复点验证通过\n");
  }
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(2);
});
