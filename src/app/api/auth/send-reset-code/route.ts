/**
 * POST /api/auth/send-reset-code
 *
 * B-01：发送密码重置验证码
 *
 * 入参:{ phone: string }
 * 返回:{ ok: true, mock: boolean, hint?: string }
 *
 * 安全策略:
 *   1. 手机号格式校验
 *   2. 手机号必须已注册（防止攻击者探测账号是否存在）
 *      - 但为了不暴露账号是否存在，对未注册手机号也返回成功（不实际发码）
 *      - 仅在已注册时才调用 sendCode
 *   3. 复用 lib/sms.ts 的频率限制（60s 内不能重复发）
 *
 * 错误:
 *   400 — phone 格式不合法
 *   429 — 频率限制
 *   500 — 其他异常
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
    // 安全策略：仅对已注册用户实际发码；未注册用户也返回成功（不暴露账号存在性）
    const user = await prisma.user.findFirst({
      where: { phone },
      select: { id: true },
    });

    if (!user) {
      // 未注册：返回成功但不实际发码（防止账号枚举攻击）
      return NextResponse.json({
        ok: true,
        mock: isSmsMockMode(),
        hint: isSmsMockMode() ? "开发环境验证码为 123456" : undefined,
      });
    }

    const result = await sendCode(phone);
    return NextResponse.json({
      ok: true,
      mock: result.mock,
      hint: result.mock ? "开发环境验证码为 123456" : undefined,
    });
  } catch (err) {
    if (err instanceof SmsError && err.code === "RATE_LIMIT") {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[send-reset-code] 发送失败:", err);
    return NextResponse.json({ error: "验证码发送失败" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
