/**
 * POST /api/user/bind-phone
 *
 * 已登录用户换绑手机号(个人中心 → 账号与安全 → 换绑)
 *
 * 入参:{ phone, code }
 * 认证:NextAuth session(不支持小程序 JWT,小程序暂不开放换绑)
 *
 * 流程:
 *   1. 校验 phone 格式
 *   2. 校验验证码(verifyCode,通过则删除防重放)
 *   3. 冲突检查:phone 已被其他账号占用 → 409
 *   4. 更新当前 user.phone
 *   5. 返回 { ok: true, phone } — 前端刷新 profile
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

    if (!phone || typeof phone !== "string" || !PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: "手机号格式不合法" }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "验证码不能为空" }, { status: 400 });
    }
    const codeValid = await verifyCode(phone, code);
    if (!codeValid) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    // 冲突检查
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        { error: "该手机号已被其他账号占用" },
        { status: 409 },
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { phone },
    });

    return NextResponse.json({ ok: true, phone });
  } catch (error) {
    console.error("[user/bind-phone] 换绑失败:", error);
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError?.code === "P2002") {
      return NextResponse.json({ error: "该手机号已被占用" }, { status: 409 });
    }
    return NextResponse.json({ error: "换绑失败,请稍后重试" }, { status: 500 });
  }
}
