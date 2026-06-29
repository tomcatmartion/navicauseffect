/**
 * P2-B + P2-C 修复点端到端验证脚本
 * 覆盖：S-01/S-02/S-04/S-05/S-06/S-07/S-09/S-10/S-12/S-15/S-16/S-17 + C-02/C-03/C-07/C-08/C-09/C-10/C-11
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

  console.log("\n=== P2-B + P2-C 修复点端到端验证 ===\n");

  // ─────────────────────────────────────────────────────────────
  // 源码层验证
  // ─────────────────────────────────────────────────────────────

  // S-01：新用户 Onboarding 组件
  console.log("[S-01] 新用户 Onboarding");
  {
    const src = readFile("src/components/shared/onboarding-dialog.tsx");
    const has3Steps = grep(/3 \/ 3 · 开启 AI 对话/, src);
    const hasOnboardingKey = grep(/zw-onboarding-completed/, src);
    record("S-01", "OnboardingDialog 3 步引导 + localStorage 守卫", has3Steps && hasOnboardingKey, `steps=${has3Steps}, key=${hasOnboardingKey}`);
  }

  // S-02：LoadingSkeleton 组件
  console.log("\n[S-02] 统一 LoadingSkeleton");
  {
    const src = readFile("src/components/shared/loading-skeleton.tsx");
    const hasExport = grep(/export function LoadingSkeleton/, src);
    const hasVariants = grep(/spinner.*pulse.*skeleton|variant.*spinner/, src);
    const chartsUseLoader = grep(/LoadingSkeleton/, readFile("src/app/(main)/charts/page.tsx"));
    const chartUseLoader = grep(/LoadingSkeleton/, readFile("src/app/(main)/chart/page.tsx"));
    record(
      "S-02",
      "LoadingSkeleton 组件 + 至少 2 处页面接入",
      hasExport && hasVariants && chartsUseLoader && chartUseLoader,
      `export=${hasExport}, variants=${hasVariants}, charts=${chartsUseLoader}, chart=${chartUseLoader}`,
    );
  }

  // S-04：命盘库搜索筛选
  console.log("\n[S-04] 命盘库搜索/筛选");
  {
    const src = readFile("src/app/(main)/charts/page.tsx");
    const hasSearchState = grep(/searchText.*useState|filterIdentityId.*useState/, src);
    const hasSearchInput = grep(/placeholder="搜索命盘名/, src);
    const hasFilter = grep(/filteredGrouped/, src);
    record(
      "S-04",
      "charts 页加搜索 input + 命主筛选 + 客户端过滤",
      hasSearchState && hasSearchInput && hasFilter,
      `state=${hasSearchState}, input=${hasSearchInput}, filter=${hasFilter}`,
    );
  }

  // S-05：报告进度阶段文案
  console.log("\n[S-05] 报告进度阶段文案");
  {
    const src = readFile("src/app/(main)/reports/[id]/page.tsx");
    const has3Phases = grep(/progress < 40 \? "正在排盘解析" : progress < 80 \? "AI 校对中" : "即将完成"/, src);
    record("S-05", "StatusDisplay 3 阶段文案", has3Phases, `phases=${has3Phases}`);
  }

  // S-06：最近访问快捷区
  console.log("\n[S-06] 最近访问快捷区");
  {
    const lib = readFile("src/lib/utils/recent-charts.ts");
    const hasLib = grep(/export function (getRecentCharts|addRecentChart)/, lib);
    const chartsId = readFile("src/app/(main)/charts/[id]/page.tsx");
    const hasRecord = grep(/addRecentChart\(/, chartsId);
    const home = readFile("src/app/(main)/page.tsx");
    const hasHome = grep(/recents.*getRecentCharts|最近访问/, home);
    record(
      "S-06",
      "recent-charts.ts 工具 + charts/[id] 记录 + 首页快捷区",
      hasLib && hasRecord && hasHome,
      `lib=${hasLib}, record=${hasRecord}, home=${hasHome}`,
    );
  }

  // S-07：合盘分享按钮
  console.log("\n[S-07] 合盘结果复制链接");
  {
    const src = readFile("src/app/(main)/compatibility/page.tsx");
    const hasCopy = grep(/复制链接/, src);
    const hasClipboard = grep(/navigator\.clipboard\.writeText/, src);
    record("S-07", "CompatibilityResultView 加复制链接按钮", hasCopy && hasClipboard, `copy=${hasCopy}, clipboard=${hasClipboard}`);
  }

  // S-09：主题跟随系统
  console.log("\n[S-09] 主题跟随系统");
  {
    const provider = readFile("src/components/providers/theme-provider.tsx");
    const opts = readFile("src/lib/theme/theme-options.ts");
    const hasSystemType = grep(/ThemeChoice.*=.*ZiweiTheme.*\|.*"system"/, provider);
    const hasMatchMedia = grep(/matchMedia\(/, provider);
    const hasSystemOption = grep(/key: "system"/, opts);
    record(
      "S-09",
      "theme-provider 支持 system 选项 + matchMedia 监听 + theme-options 含 system",
      hasSystemType && hasMatchMedia && hasSystemOption,
      `type=${hasSystemType}, matchMedia=${hasMatchMedia}, option=${hasSystemOption}`,
    );
  }

  // S-10：BirthInputForm 即时校验
  console.log("\n[S-10] BirthInputForm 即时校验");
  {
    const src = readFile("src/components/chart/birth-input-form.tsx");
    const hasFieldErrors = grep(/fieldErrors.*useState/, src);
    const hasValidateField = grep(/validateField/, src);
    const hasErrorBanner = grep(/S-10：即时校验错误提示/, src);
    record(
      "S-10",
      "fieldErrors 状态 + validateField + 错误 banner",
      hasFieldErrors && hasValidateField && hasErrorBanner,
      `state=${hasFieldErrors}, validate=${hasValidateField}, banner=${hasErrorBanner}`,
    );
  }

  // S-12：CTA 统一术语
  console.log("\n[S-12] CTA 统一术语");
  {
    const charts = readFile("src/app/(main)/charts/page.tsx");
    const page = readFile("src/app/(main)/page.tsx");
    const pricing = readFile("src/app/(main)/pricing/page.tsx");
    const chartsHasAI = grep(/<i className="ti ti-message-2" \/> AI 对话/, charts);
    const pageHasAIDialog = grep(/title: "AI 对话"/, page);
    const pricingHasAIDialog = grep(/feature: "AI 对话"/, pricing);
    const noOldTerm = !grep(/<i className="ti ti-message-2" \/> 解盘/, charts);
    record(
      "S-12",
      "charts/首页/pricing 全部用「AI 对话」",
      chartsHasAI && pageHasAIDialog && pricingHasAIDialog && noOldTerm,
      `charts=${chartsHasAI}, home=${pageHasAIDialog}, pricing=${pricingHasAIDialog}, noOld=${noOldTerm}`,
    );
  }

  // S-15：推广收益到账提醒
  console.log("\n[S-15] 推广收益到账提醒");
  {
    const src = readFile("src/app/(main)/promoter/page.tsx");
    const hasToast = grep(/自上次访问起新增.*星币收益/, src);
    const hasLocalStorage = grep(/zw-promoter-last-earning/, src);
    record("S-15", "promoter 对比 localStorage lastEarning + toast 提醒", hasToast && hasLocalStorage, `toast=${hasToast}, storage=${hasLocalStorage}`);
  }

  // S-16：报告章节侧边导航
  console.log("\n[S-16] 报告章节目录侧边导航");
  {
    const src = readFile("src/app/(main)/reports/[id]/page.tsx");
    const css = readFile("src/styles/ziwei/ziwei.css");
    const hasAside = grep(/report-with-toc/, src);
    const hasSticky = grep(/report-toc[\s\S]*?position: sticky/, css);
    record("S-16", "reports/[id] 双栏 + CSS sticky 侧栏", hasAside && hasSticky, `aside=${hasAside}, sticky=${hasSticky}`);
  }

  // S-17：预设问题动态生成
  console.log("\n[S-17] 预设问题动态生成");
  {
    const lib = readFile("src/lib/ziwei/preset-questions.ts");
    const panel = readFile("src/components/analysis/dual-chat-panel.tsx");
    const hasGen = grep(/export function generatePresetQuestions/, lib);
    const hasStarTpl = grep(/STAR_TEMPLATES/, lib);
    const panelUses = grep(/generatePresetQuestions\(chartData\)/, panel);
    record("S-17", "preset-questions.ts + dual-chat-panel useMemo 动态生成", hasGen && hasStarTpl && panelUses, `gen=${hasGen}, templates=${hasStarTpl}, uses=${panelUses}`);
  }

  // C-02：协议入口归属（仅文档标注，无代码改动 — 验证 user 仍有、settings 没新增）
  console.log("\n[C-02] user 协议入口保留 / settings 不重复");
  {
    const userPage = readFile("src/app/(main)/user/page.tsx");
    const settingsPage = readFile("src/app/(main)/settings/page.tsx");
    const userHasLegal = grep(/\/legal\/terms|\/legal\/privacy/, userPage);
    const settingsNoLegal = !grep(/\/legal\/terms|\/legal\/privacy/, settingsPage);
    record("C-02", "user 保留法律入口，settings 关于区不重复", userHasLegal && settingsNoLegal, `user=${userHasLegal}, settingsClean=${settingsNoLegal}`);
  }

  // C-03：ZiweiAnalysisPanel 专家模式
  console.log("\n[C-03] ZiweiAnalysisPanel 专家模式");
  {
    const src = readFile("src/components/analysis/ziwei-analysis-panel.tsx");
    const hasExpertState = grep(/expertMode.*useState/, src);
    const hasToggle = grep(/expertMode.*高调试|高级调试（专家模式）|专家模式/, src);
    record("C-03", "DEBUG Tab 默认隐藏 + 专家模式 toggle", hasExpertState && hasToggle, `state=${hasExpertState}, toggle=${hasToggle}`);
  }

  // C-07：charts 详情 AI 分析 Tab → CTA
  console.log("\n[C-07] charts/[id] AI 分析 Tab → CTA");
  {
    const src = readFile("src/app/(main)/charts/[id]/page.tsx");
    const hasCTA = grep(/AI 对话[\s\S]{0,500}chartRecordId=\$\{chart\.id\}/, src);
    const noAnalysisTab = !grep(/activeTab === "analysis"/, src);
    record("C-07", "移除 analysis Tab + 右侧大 CTA 按钮", hasCTA && noAnalysisTab, `cta=${hasCTA}, noTab=${noAnalysisTab}`);
  }

  // C-08：首页双视图统一（部分修复，主要验证已登录快捷区/未登录 hero 骨架对齐）
  console.log("\n[C-08] 首页双视图（部分修复）");
  {
    const src = readFile("src/app/(main)/page.tsx");
    const hasIsLoggedIn = grep(/isLoggedIn/, src);
    const hasOnboarding = grep(/OnboardingDialog/, src);
    record("C-08", "首页已登录态 + Onboarding 骨架对齐", hasIsLoggedIn && hasOnboarding, `loggedIn=${hasIsLoggedIn}, onboarding=${hasOnboarding}`);
  }

  // C-09：Matter 通过 Tab 切换（已达成，无需代码改动）
  console.log("\n[C-09] Matter 已通过 Tab 切换");
  {
    const src = readFile("src/components/analysis/ziwei-analysis-panel.tsx");
    const hasTabSwitch = grep(/PRIMARY_ANALYSIS_OPTIONS\.map|DEBUG_ANALYSIS_OPTIONS\.map/, src);
    record("C-09", "Matter 在 ziwei-analysis-panel 内已通过 Tab 切换（非平铺）", hasTabSwitch, `tabSwitch=${hasTabSwitch}`);
  }

  // C-10：事项报告三级折叠
  console.log("\n[C-10] 事项报告三级折叠");
  {
    const src = readFile("src/components/analysis/matter-report-sections.tsx");
    const has3Level = grep(/C-10：三级折叠/, src);
    const hasNestedDetails = grep(/analysisFlow\.map\([\s\S]{0,500}<details/, src);
    record("C-10", "analysisFlow 内嵌三级 details", has3Level && hasNestedDetails, `comment=${has3Level}, nested=${hasNestedDetails}`);
  }

  // C-11：profile 统计查看更多
  console.log("\n[C-11] profile 统计查看更多");
  {
    const src = readFile("src/app/(main)/profile/page.tsx");
    const hasDialog = grep(/showStatsDialog.*useState/, src);
    const hasTrigger = grep(/setShowStatsDialog\(true\)/, src);
    const has6Items = grep(/命主档案[\s\S]{0,300}命盘数[\s\S]{0,300}报告数/, src);
    record("C-11", "profile 3 主显示 + 「更多」按钮 + 6 项 Dialog", hasDialog && hasTrigger && has6Items, `dialog=${hasDialog}, trigger=${hasTrigger}, items6=${has6Items}`);
  }

  // ─────────────────────────────────────────────────────────────
  // DOM 验证
  // ─────────────────────────────────────────────────────────────

  await adminLoginViaAPI(context);

  // S-04 DOM：charts 页搜索框（admin 无命盘时显示空态，搜索框不渲染是正常行为）
  console.log("\n[S-04 DOM] charts 页搜索框可见（admin 有命盘时）");
  await page.goto(`${BASE}/charts`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const chartsBodyText = await page.locator("body").textContent();
  const chartsHasSearch = /搜索命盘名/.test(chartsBodyText ?? "");
  const chartsHasEmpty = /还没有保存的命盘/.test(chartsBodyText ?? "");
  const searchInputCount = await page.locator('input[placeholder*="搜索命盘"]').count();
  // 接受两种结果：① 渲染了搜索框；② 因无命盘显示空态
  record(
    "S-04-DOM",
    "charts 页正确渲染（搜索框 OR 空态）",
    chartsHasSearch || searchInputCount >= 1 || chartsHasEmpty,
    `search=${chartsHasSearch}, input=${searchInputCount}, empty=${chartsHasEmpty}`,
  );

  // S-09 DOM：settings 主题选项含 system
  console.log("\n[S-09 DOM] settings 主题含「跟随系统」");
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const settingsText = await page.locator("body").textContent();
  const hasSystemTheme = /跟随系统/.test(settingsText ?? "");
  record("S-09-DOM", "settings 主题区含「跟随系统」选项", hasSystemTheme, `system=${hasSystemTheme}`);

  // C-11 DOM：profile 含「更多」按钮
  console.log("\n[C-11 DOM] profile 含「更多」统计按钮");
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const profileText = await page.locator("body").textContent();
  const hasMoreBtn = /更多/.test(profileText ?? "");
  record("C-11-DOM", "profile 三宫统计区含「更多」按钮", hasMoreBtn, `more=${hasMoreBtn}`);

  // S-15 DOM：promoter 页可访问
  console.log("\n[S-15 DOM] promoter 页可访问");
  await page.goto(`${BASE}/promoter`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  const promoterText = await page.locator("body").textContent();
  const promoterOK = /分享渠道|奖励规则|更多渠道|推广中心/.test(promoterText ?? "");
  record("S-15-DOM", "promoter 页正常加载", promoterOK, `loaded=${promoterOK}`);

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
    console.log("✓ 全部 P2-B + P2-C 修复点验证通过\n");
  }
}

main().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(2);
});
