/**
 * POST /api/auth/forgot-password
 *
 * B-01：重置密码（验证码校验 + bcrypt 更新）
 *
 * 入参:{ phone: string, code: string, newPassword: string }
 * 返回:{ ok: true }
 *
 * 流程:
 *   1. 校验手机号 + 验证码格式
 *   2. verifyCode(phone, code) 消费验证码（防重放）
 *   3. 查找用户；不存在则返回错误（此时账号已被锁定）
 *   4. bcrypt.hash(newPassword) 加密
 *   5. prisma.user.update({ password })
 *   6. 返回成功，前端引导用户去登录
 *
 * 错误:
 *   400 — 参数不合法 / 验证码错误
 *   404 — 用户不存在
 *   500 — 其他异常
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { verifyCode } from "@/lib/sms";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const { phone, code, newPassword } = body as {
    phone?: string;
    code?: string;
    newPassword?: string;
  };

  // 1. 参数校验
  if (!phone || !PHONE_REGEX.test(phone)) {
    return NextResponse.json({ error: "手机号格式不合法" }, { status: 400 });
  }
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "验证码必须是 6 位数字" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "密码长度至少 6 位" }, { status: 400 });
  }
  if (newPassword.length > 128) {
    return NextResponse.json({ error: "密码长度不能超过 128 位" }, { status: 400 });
  }

  try {
    // 2. 校验验证码（消费型，防重放）
    const codeValid = await verifyCode(phone, code);
    if (!codeValid) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    // 3. 查找用户
    const user = await prisma.user.findFirst({
      where: { phone },
      select: { id: true, password: true },
    });
    if (!user) {
      return NextResponse.json({ error: "账号不存在" }, { status: 404 });
    }

    // 4. bcrypt 加密新密码（10 rounds 与现有注册流程一致）
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. 更新密码
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password] 重置失败:", err);
    return NextResponse.json({ error: "重置失败，请稍后重试" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
