/**
 * POST /api/auth/sms/send
 *
 * 发送手机号验证码(注册/登录/绑定手机号共用)
 *
 * 入参:{ phone: string }
 * 返回:{ ok: true, mock: boolean }(mock 模式前端可提示"开发环境验证码为 123456")
 *
 * 错误:
 *   400 — phone 格式不合法
 *   429 — 频率限制(60s 内重复请求)
 *   500 — Redis 或其他异常
 */

import { NextRequest, NextResponse } from "next/server";
import { sendCode, isSmsMockMode, SmsError } from "@/lib/sms";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { phone } = body as { phone?: string };
  if (!phone || typeof phone !== "string" || !PHONE_REGEX.test(phone)) {
    return NextResponse.json({ error: "手机号格式不合法" }, { status: 400 });
  }

  try {
    const result = await sendCode(phone);
    return NextResponse.json({
      ok: true,
      mock: result.mock,
      // mock 模式给前端一个明确提示(用户能看到验证码,避免开发环境去查 Redis)
      hint: result.mock ? "开发环境验证码为 123456" : undefined,
    });
  } catch (err) {
    if (err instanceof SmsError && err.code === "RATE_LIMIT") {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[sms/send] 发送失败:", err);
    return NextResponse.json({ error: "验证码发送失败" }, { status: 500 });
  }
}

// 防止 Next.js 缓存(每次请求都重新执行)
export const dynamic = "force-dynamic";
