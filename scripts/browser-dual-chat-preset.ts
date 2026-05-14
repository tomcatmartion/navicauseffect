/**
 * 真实浏览器：与用户在排盘页点预设问题一致（同一 Cookie 域、同一 UI）
 * 用 `context.request` 完成与 `smoke-hybrid-reading` 相同的 CSRF + credentials，
 * 再 `page.goto(/chart)` → 生成命盘 → 点预设句 → 等流式结束 → stdout 打印 AI 正文
 *
 * 须：`pnpm dev` 在 BASE_URL；`pnpm exec playwright install chromium`
 *
 * BASE_URL=http://127.0.0.1:3333 PRESET_QUESTION='我明年的财运怎么样？' pnpm exec tsx --tsconfig tsconfig.json scripts/browser-dual-chat-preset.ts
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3333";
const USER = process.env.SMOKE_USERNAME ?? "admin";
const PASS = process.env.SMOKE_PASSWORD ?? "ffffff";
const PRESET =
  process.env.PRESET_QUESTION?.trim() || "我明年的财运怎么样？";
const STREAM_MS = Math.max(
  60_000,
  Number.parseInt(process.env.BROWSER_STREAM_TIMEOUT_MS ?? "900000", 10) ||
    900_000,
);

void (async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  try {
    const csrfRes = await context.request.get(`${BASE}/api/auth/csrf`);
    if (!csrfRes.ok()) {
      throw new Error(`csrf ${csrfRes.status()}`);
    }
    const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
    const csrfToken = csrfJson.csrfToken ?? "";
    if (!csrfToken) throw new Error("无 csrfToken");

    const loginRes = await context.request.post(
      `${BASE}/api/auth/callback/credentials`,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        form: {
          username: USER,
          password: PASS,
          csrfToken,
          callbackUrl: "/chart",
          redirect: "false",
        },
      },
    );
    const ok =
      loginRes.status() === 200 ||
      (loginRes.status() >= 300 && loginRes.status() < 400);
    if (!ok) {
      const t = await loginRes.text();
      throw new Error(`登录失败 HTTP ${loginRes.status()} ${t.slice(0, 200)}`);
    }

    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/chart`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });

    await page.getByRole("button", { name: "生成命盘" }).click();

    await page.getByText("AI 精准解盘").first().waitFor({
      state: "visible",
      timeout: 180_000,
    });
    await page.getByText("AI 精准解盘").first().scrollIntoViewIfNeeded();

    const presetBtn = page.getByRole("button", { name: PRESET, exact: true });
    await presetBtn.scrollIntoViewIfNeeded();
    await presetBtn.click();

    try {
      await page.waitForFunction(
        () => {
          const busy = [...document.querySelectorAll("span")].some((s) =>
            (s.textContent ?? "").includes("正在调动各类知识"),
          );
          const blocks = [
            ...document.querySelectorAll(".whitespace-pre-wrap.leading-relaxed"),
          ];
          if (blocks.length === 0) return false;
          const last = (blocks[blocks.length - 1]?.textContent ?? "").trim();
          return !busy && last.length > 40;
        },
        undefined,
        { timeout: STREAM_MS },
      );
    } catch {
      const snap = await page.evaluate(() => {
        const busy = [...document.querySelectorAll("span")].some((s) =>
          (s.textContent ?? "").includes("正在调动各类知识"),
        );
        const blocks = [
          ...document.querySelectorAll(".whitespace-pre-wrap.leading-relaxed"),
        ];
        const texts = blocks.map((b) => (b.textContent ?? "").trim());
        return { busy, texts };
      });
      console.error(
        `[browser-dual-chat] 在 ${STREAM_MS}ms 内未等到「分析结束 + 正文>40 字」。页面快照：`,
        JSON.stringify(snap, null, 2),
      );
      throw new Error(
        "流式未在时限内完成（与页面上一直转圈同源：Hybrid 等上游过久）。可调大 BROWSER_STREAM_TIMEOUT_MS 或修后端尽快写出 SSE。",
      );
    }

    const bubbles = page.locator(".whitespace-pre-wrap.leading-relaxed");
    const n = await bubbles.count();
    if (n < 1) {
      throw new Error("未找到任何对话正文节点");
    }
    const lastText = (await bubbles.nth(n - 1).innerText()).trim();
    if (!lastText) {
      throw new Error("最后一条对话为空");
    }

    console.log(lastText);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
