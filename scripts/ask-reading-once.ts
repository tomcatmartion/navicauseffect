/**
 * 与浏览器 `dual-chat-panel` 一致：登录 → POST /api/ziwei/reading（Hybrid 流式）
 * SSE 按行解析（与 `dual-chat-panel.tsx` 相同逻辑），非按 \\n\\n 块。
 *
 * 用法: BASE_URL=http://127.0.0.1:3333 READING_QUESTION='…' npx tsx scripts/ask-reading-once.ts
 */
import "dotenv/config";
import { Agent, fetch as undiciFetch } from "undici";
import { CHART_FIXTURE } from "../src/core/stages/__tests__/chart-fixture";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3333";
const SMOKE_USER = process.env.SMOKE_USERNAME || "admin";
const SMOKE_PASS = process.env.SMOKE_PASSWORD || "ffffff";
const TIMEOUT_MS = Math.max(
  120_000,
  Number.parseInt(process.env.READING_TIMEOUT_MS ?? "480000", 10) || 480_000,
);

const readingAgent = new Agent({
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 60_000,
});

function parseSetCookie(headers: Headers): string {
  const getSetCookie = headers.getSetCookie?.();
  if (getSetCookie?.length) {
    return getSetCookie.map((s) => s.split(";")[0]).join("; ");
  }
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return "";
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  return arr.map((s) => s.split(";")[0]).join("; ");
}

async function login(): Promise<string> {
  let cookie = "";
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  const c1 = parseSetCookie(csrfRes.headers);
  if (c1) cookie = c1;
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  const csrfToken = csrfJson.csrfToken ?? "";
  if (!csrfToken) throw new Error("无 csrfToken");

  const body = new URLSearchParams({
    username: SMOKE_USER,
    password: SMOKE_PASS,
    csrfToken,
    callbackUrl: "/",
    redirect: "false",
  }).toString();

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body,
    redirect: "manual",
  });
  const c2 = parseSetCookie(loginRes.headers);
  if (c2) cookie = cookie ? `${cookie}; ${c2}` : c2;
  const loginJson = (await loginRes.json().catch(() => ({}))) as { error?: string };
  const loginOk =
    (loginRes.status === 200 && !loginJson?.error) ||
    (loginRes.status >= 300 && loginRes.status < 400);
  if (!loginOk) {
    throw new Error(`登录失败 ${loginRes.status} ${JSON.stringify(loginJson)}`);
  }
  if (!cookie) throw new Error("登录后无 Cookie");
  return cookie;
}

/** 与 `dual-chat-panel.tsx` SSE 循环对齐 */
function consumeSseLines(
  sseCarry: string,
  linesOut: string[],
  done: boolean,
): string {
  const lines = sseCarry.split("\n");
  return done ? "" : lines.pop() ?? "";
}

async function main() {
  const question = process.env.READING_QUESTION || "我明年的财运怎么样？";
  const arch =
    (process.env.READING_ARCHITECTURE as "hybrid" | "skill" | "rag" | undefined) ??
    "hybrid";

  console.error(
    "BASE_URL=",
    BASE,
    "TIMEOUT_MS=",
    TIMEOUT_MS,
    "architecture=",
    arch,
    "（与浏览器 body 一致：stream + architecture + chartData）",
  );
  const cookie = await login();
  console.error("登录 ok，请求解盘…");

  const res = await undiciFetch(`${BASE}/api/ziwei/reading`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      question,
      stream: true,
      architecture: arch,
      chartData: CHART_FIXTURE as Record<string, unknown>,
    }),
    dispatcher: readingAgent,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    console.error("HTTP", res.status, j);
    process.exit(1);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!res.body || !ct.includes("text/event-stream")) {
    console.error("非 SSE:", ct);
    process.exit(1);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let sseCarry = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    sseCarry += dec.decode(value ?? new Uint8Array(), { stream: !done });

    const lines = sseCarry.split("\n");
    sseCarry = done ? "" : lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.replace(/\r$/, "").trimStart();
      if (!line.toLowerCase().startsWith("data:")) continue;
      const payload = line.slice(5).trimStart();
      if (payload === "[DONE]") continue;

      try {
        const parsed = JSON.parse(payload) as {
          text?: string;
          error?: string;
          type?: string;
          debugInfo?: unknown;
        };

        if (parsed.type === "debug" && parsed.debugInfo) {
          continue;
        }

        if (parsed.error) {
          console.error("SSE error:", parsed.error);
          process.exit(1);
        }

        if (typeof parsed.text === "string" && parsed.text.length > 0) {
          full += parsed.text;
        }
      } catch {
        /* 半行 JSON */
      }
    }

    if (done) break;
  }

  if (!full.trim()) {
    console.error("未拼出任何正文");
    process.exit(1);
  }

  console.log(full.trim());
}

void (async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
