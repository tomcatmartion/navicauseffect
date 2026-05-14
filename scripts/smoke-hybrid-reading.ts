/**
 * 冒烟：登录 →（可选）chart-pipeline-debug 快路径 →（可选）Hybrid 流式解盘
 * 运行: BASE_URL=http://127.0.0.1:3333 pnpm run smoke:reading
 * - `SMOKE_SKIP_LLM=1`：只做无 LLM 的快路径（chart-pipeline-debug），适合 CI/无密钥环境
 * - 默认会跑 Hybrid `/api/ziwei/reading`：`SMOKE_TIMEOUT_MS`（默认 600000）；解盘请求用 undici `Agent`（headers/body 超时 0）+ `AbortSignal` 总上限
 */
import "dotenv/config";
import { Agent, fetch as undiciFetch } from "undici";
import { CHART_FIXTURE } from "../src/core/stages/__tests__/chart-fixture";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3333";
const SMOKE_USER = process.env.SMOKE_USERNAME || "admin";
const SMOKE_PASS = process.env.SMOKE_PASSWORD || "ffffff";
/** 整段解盘流式等待（默认 10 分钟，含慢模型首包） */
const SMOKE_TIMEOUT_MS = Math.max(
  60_000,
  Number.parseInt(process.env.SMOKE_TIMEOUT_MS ?? "600000", 10) || 600_000,
);

/** Hybrid 在返回 HTTP 头前会 await 上游建连，首包时间不定；headersTimeout 用 0 关闭，总时长靠 AbortSignal */
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

/** 无 LLM：验证 chart 管线快照与 Hybrid 前置逻辑 */
async function smokeChartPipelineDebug(): Promise<void> {
  const res = await fetch(`${BASE}/api/ziwei/chart-pipeline-debug`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chartData: CHART_FIXTURE,
      affairType: "求财",
      affair: "smoke-hybrid-reading",
      targetYear: 2026,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !j.ok) {
    console.error("chart-pipeline-debug 失败", res.status, j);
    process.exit(1);
  }
  console.log("chart-pipeline-debug 快路径 ok");
}

async function smokeHybridReadingStream(cookie: string): Promise<void> {
  let res: Response;
  try {
    res = await undiciFetch(`${BASE}/api/ziwei/reading`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        question: "我的事业运如何？",
        stream: true,
        architecture: "hybrid",
        chartData: CHART_FIXTURE as Record<string, unknown>,
      }),
      dispatcher: readingAgent,
      signal: AbortSignal.timeout(SMOKE_TIMEOUT_MS),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      console.error(`解盘请求超时（>${SMOKE_TIMEOUT_MS}ms），可调大 SMOKE_TIMEOUT_MS、设 SMOKE_SKIP_LLM=1 跳过 LLM，或检查模型/API`);
      process.exit(1);
    }
    throw e;
  }

  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; _debug?: string };
    console.error("HTTP", res.status, j);
    if (j._debug) console.error("_debug:", j._debug);
    process.exit(1);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/event-stream") || !res.body) {
    console.error("非 SSE:", ct);
    process.exit(1);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let gotText = false;
  let gotErr = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const block of parts) {
      for (const line of block.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        try {
          const o = JSON.parse(raw) as { text?: string; error?: string };
          if (o.error) {
            console.error("SSE error:", o.error);
            gotErr = true;
          }
          if (o.text && o.text.length > 0) gotText = true;
        } catch {
          /* 半包 */
        }
      }
    }
    if (gotErr) process.exit(1);
    if (gotText) break;
  }

  if (!gotText) {
    console.error("未收到任何正文增量（可能空流或解析失败）");
    process.exit(1);
  }
  console.log("Hybrid 流式解盘冒烟通过（已收到正文增量）");
}

async function main() {
  const skipLlm = process.env.SMOKE_SKIP_LLM === "1";
  console.log("BASE_URL=", BASE, "SMOKE_TIMEOUT_MS=", SMOKE_TIMEOUT_MS, "SMOKE_SKIP_LLM=", skipLlm ? "1" : "0");
  const cookie = await login();
  console.log("登录 ok");

  await smokeChartPipelineDebug();

  if (skipLlm) {
    console.log("已跳过 Hybrid LLM 流式步骤（SMOKE_SKIP_LLM=1），冒烟结束");
    return;
  }

  await smokeHybridReadingStream(cookie);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
