/**
 * POST /api/auth/change-password
 *
 * B-01-2：已登录用户修改密码
 *
 * 入参:{ oldPassword: string, newPassword: string }
 * 返回:{ ok: true }
 *
 * 流程:
 *   1. 从 NextAuth session 取当前用户（必须已登录）
 *   2. 校验用户必须有 password 字段（手机/微信注册用户无 password，需先走 forgot-password）
 *   3. bcrypt.compare(oldPassword) 校验旧密码
 *   4. 校验新密码 ≠ 旧密码
 *   5. bcrypt.hash(newPassword) 加密
 *   6. prisma.user.update({ password })
 *
 * 错误:
 *   401 — 未登录
 *   400 — 参数不合法 / 旧密码错误 / 新旧密码相同
 *   409 — 用户无密码字段（需走 forgot-password 流程）
 *   500 — 其他异常
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  // 1. 鉴权
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

  const { oldPassword, newPassword } = body as {
    oldPassword?: string;
    newPassword?: string;
  };

  // 2. 参数校验
  if (!oldPassword || typeof oldPassword !== "string") {
    return NextResponse.json({ error: "请输入当前密码" }, { status: 400 });
  }
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "新密码长度至少 6 位" }, { status: 400 });
  }
  if (newPassword.length > 128) {
    return NextResponse.json({ error: "新密码长度不能超过 128 位" }, { status: 400 });
  }
  if (oldPassword === newPassword) {
    return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 });
  }

  try {
    // 3. 查找用户
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    if (!user.password) {
      // 手机/微信注册用户无密码 — 引导走 forgot-password 设置初始密码
      return NextResponse.json(
        { error: "您尚未设置过密码（手机号或微信注册账号）。请使用「忘记密码」流程设置初始密码。", code: "NO_PASSWORD_SET" },
        { status: 409 },
      );
    }

    // 4. 校验旧密码
    const oldValid = await bcrypt.compare(oldPassword, user.password);
    if (!oldValid) {
      return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
    }

    // 5. 加密 + 更新
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[change-password] 修改失败:", err);
    return NextResponse.json({ error: "修改失败，请稍后重试" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
