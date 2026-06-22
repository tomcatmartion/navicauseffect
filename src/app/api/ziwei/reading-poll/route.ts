/**
 * HTTP 长轮询版 AI 解盘端点（小程序专用）
 *
 * POST /api/ziwei/reading-poll
 *   Headers: Authorization: Bearer <miniprogram-token>
 *   Body:    { question, chartData?, sessionId?, chartRecordId?, parentBirthYears?, targetYear? }
 *   Resp:    { sessionId }
 *
 * GET /api/ziwei/reading-poll?sessionId=xxx&offset=N
 *   Headers: Authorization: Bearer <miniprogram-token>
 *   Resp:    { items: [{text|error|type, ts}], nextOffset, done }
 *
 * 设计：
 *   - POST 不阻塞：立即返回 sessionId，后台 fire-and-forget 跑 AI 流
 *   - 后台 task 复用现有 SSE 内核 `runHybridPipeline`
 *   - 每个 chunk 写 Redis list `chat_stream:{sessionId}`，TTL 3600s
 *   - GET 用 LRANGE 取增量
 *
 * 不使用 `after()`：
 *   - 本项目是 Node standalone 部署（非 serverless），event loop 内的 Promise 不会被 kill
 *   - fire-and-forget 更简单可靠
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { extractMiniprogramUser } from "@/lib/jwt-miniprogram";
import { prisma } from "@/lib/db";
import { runHybridPipeline, appendAssistantReply } from "@/orchestration/hybrid";
import { parseOpenAiSseEventBlock } from "@/lib/ai/openai-sse";
import { parseHybridAssistantPayload } from "@/core/adapters/iztro/ai-parse";

const STREAM_KEY_PREFIX = "chat_stream:";
const META_KEY_PREFIX = "chat_session:";
const STREAM_TTL_SECONDS = 3600;
const MAX_OFFSET_RANGE = 500; // 单次 LRANGE 上限

// ─── POST 启动 ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const mpUser = await extractMiniprogramUser(request.headers.get("authorization"));
  if (!mpUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const b = body as {
    question?: string;
    chartData?: unknown;
    sessionId?: string;
    chartRecordId?: string;
    parentBirthYears?: { father?: number; mother?: number };
    targetYear?: number;
  };

  const question = typeof b.question === "string" ? b.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "缺少 question 参数" }, { status: 400 });
  }

  // sessionId 复用（多轮对话）或新生成
  const sessionId = b.sessionId || generateSessionId();

  // 解析 chartData：直接传 > 从 chartRecordId 取
  let chartData = b.chartData;
  if (!chartData && b.chartRecordId) {
    const record = await prisma.chartRecord.findFirst({
      where: { id: b.chartRecordId, userId: mpUser.userId },
      select: { chartSnapshot: true },
    });
    if (record?.chartSnapshot) {
      const snapshot = record.chartSnapshot as { astrolabe?: unknown };
      chartData = snapshot;
    }
  }

  if (!chartData) {
    return NextResponse.json(
      { error: "首次解盘需要提供命盘数据（chartData 或 chartRecordId）" },
      { status: 400 },
    );
  }

  // 写 session 元数据（用于 GET 校验所有权）
  await redis.setex(
    META_KEY_PREFIX + sessionId,
    STREAM_TTL_SECONDS,
    JSON.stringify({
      userId: mpUser.userId,
      openid: mpUser.openid,
      question,
      createdAt: Date.now(),
    }),
  );

  // 初始化 stream key（即使为空也 setex，避免 GET 时 key 不存在）
  await redis.expire(STREAM_KEY_PREFIX + sessionId, STREAM_TTL_SECONDS);

  // 立即响应，fire-and-forget 启动后台 task
  void runBackgroundPipeline({
    sessionId,
    userId: mpUser.userId,
    question,
    chartData,
    parentBirthYears: b.parentBirthYears,
    targetYear: b.targetYear,
  }).catch((err) => {
    console.error(`[reading-poll] 后台 task 异常退出 sessionId=${sessionId}:`, err);
  });

  return NextResponse.json({ sessionId, mockMode: true });
}

// ─── GET 轮询 ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const mpUser = await extractMiniprogramUser(request.headers.get("authorization"));
  if (!mpUser) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || "";
  const offsetRaw = searchParams.get("offset");

  if (!sessionId) {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  // 校验 session 所有权
  const meta = await redis.get(META_KEY_PREFIX + sessionId);
  if (!meta) {
    return NextResponse.json(
      { error: "会话不存在或已过期", expired: true },
      { status: 404 },
    );
  }
  try {
    const parsed = JSON.parse(meta) as { userId: string };
    if (parsed.userId !== mpUser.userId) {
      return NextResponse.json({ error: "无权访问此会话" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "会话元数据损坏" }, { status: 500 });
  }

  const offset = Math.max(0, parseInt(offsetRaw || "0", 10) || 0);
  const streamKey = STREAM_KEY_PREFIX + sessionId;

  // LRANGE 取 offset 之后的所有消息（加上限保护）
  const raw = await redis.lrange(streamKey, offset, offset + MAX_OFFSET_RANGE - 1);
  const items: Array<{ text?: string; error?: string; type?: string; ts: number }> = [];
  let done = false;

  for (const line of raw) {
    try {
      const item = JSON.parse(line) as {
        text?: string;
        error?: string;
        type?: string;
        ts: number;
        done?: boolean;
      };
      if (item.done) {
        done = true;
        // 不把 done 标记本身作为 items 返回
        continue;
      }
      items.push(item);
    } catch {
      // 跳过损坏的行
    }
  }

  return NextResponse.json({
    items,
    nextOffset: offset + raw.length,
    done,
  });
}

// ─── 后台 task ─────────────────────────────────────────────────────────────

interface PipelineArgs {
  sessionId: string;
  userId: string;
  question: string;
  chartData: unknown;
  parentBirthYears?: { father?: number; mother?: number };
  targetYear?: number;
}

async function runBackgroundPipeline(args: PipelineArgs): Promise<void> {
  const { sessionId, userId, question, chartData } = args;
  const streamKey = STREAM_KEY_PREFIX + sessionId;
  const enqueue = (item: Record<string, unknown>) =>
    redis.rpush(streamKey, JSON.stringify({ ...item, ts: Date.now() }));

  console.log(`[reading-poll] 后台 task 启动 sessionId=${sessionId} q="${question.slice(0, 40)}..."`);

  try {
    const { stream, sessionId: newSessionId, debugInfo } = await runHybridPipeline({
      sessionId,
      userId,
      question,
      chartData: chartData as never,
      parentBirthYears: args.parentBirthYears,
      targetYear: args.targetYear,
    });

    // 发送 debug 信息（可选）
    if (debugInfo) {
      await enqueue({ type: "debug", stage: debugInfo.stage });
    }

    // 消费 AI SSE 流
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullReply = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        const chunk = parseOpenAiSseEventBlock(line);
        if (chunk?.providerError) {
          throw new Error(chunk.providerError);
        }
        if (chunk?.deltaText) {
          fullReply += chunk.deltaText;
          await enqueue({ text: chunk.deltaText });
        }
      }
    }

    // 流结束后解析 narrative 长度（与原 SSE 实现保持一致）
    const { narrative } = parseHybridAssistantPayload(fullReply);
    if (narrative && narrative.length > 0 && narrative.length < fullReply.length) {
      await enqueue({ type: "narrativeEnd", narrativeLength: narrative.length });
    }

    // 追加到会话历史（复用现有持久化）
    if (fullReply.length > 0) {
      try {
        await appendAssistantReply(newSessionId, fullReply);
      } catch (err) {
        console.error(`[reading-poll] appendAssistantReply 失败 sessionId=${newSessionId}:`, err);
      }
    }

    // 完成标记
    await enqueue({ done: true });
    await redis.expire(streamKey, STREAM_TTL_SECONDS);
    console.log(`[reading-poll] 后台 task 完成 sessionId=${sessionId} 回复长度=${fullReply.length}`);
  } catch (err) {
    console.error(`[reading-poll] 后台 task 失败 sessionId=${sessionId}:`, err);
    const errMsg = err instanceof Error ? err.message : String(err);
    let userMessage = "解盘失败，请稍后重试";
    if (errMsg.includes("未配置任何 AI 模型")) userMessage = "AI 模型未配置";
    else if (errMsg.includes("timeout") || errMsg.includes("超时")) userMessage = "AI 响应超时";
    else if (errMsg.includes("缺少命盘数据")) userMessage = "命盘数据不完整";

    await enqueue({ error: userMessage });
    await enqueue({ done: true });
    await redis.expire(streamKey, STREAM_TTL_SECONDS);
  }
}

function generateSessionId(): string {
  // 简单的 nanoid 替代（cuid 太长，uuid 也可以）
  return "mp_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
