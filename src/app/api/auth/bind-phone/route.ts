/**
 * POST /api/auth/bind-phone
 *
 * 微信扫码新用户首次登录后,绑定手机号
 *
 * 入参:{ phone, code }
 * 认证:必须已登录(NextAuth session)
 *
 * 流程:
 *   1. 校验 phone 格式
 *   2. 校验验证码(verifyCode,通过则删除防重放)
 *   3. 冲突检查:phone 已被其他账号占用 → 409(不合并账号)
 *   4. 更新当前 user.phone
 *   5. 返回 { ok: true } — 前端调用 session.update() 清除 phoneBindingRequired
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { verifyCode } from "@/lib/sms";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
    }

    const { phone, code } = body as { phone?: string; code?: string };

    // 1. 校验 phone 格式
    if (!phone || typeof phone !== "string" || !PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: "手机号格式不合法" }, { status: 400 });
    }

    // 2. 校验验证码
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "验证码不能为空" }, { status: 400 });
    }
    const codeValid = await verifyCode(phone, code);
    if (!codeValid) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    // 3. 冲突检查:phone 已被其他账号占用 → 409
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        { error: "该手机号已注册,请用手机号验证码登录" },
        { status: 409 },
      );
    }

    // 4. 更新当前 user.phone
    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone },
    });

    return NextResponse.json({ ok: true, phone });
  } catch (error) {
    console.error("[bind-phone] 绑定失败:", error);
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ error: "该手机号已被占用" }, { status: 409 });
    }
    return NextResponse.json({ error: "绑定失败,请稍后重试" }, { status: 500 });
  }
}
