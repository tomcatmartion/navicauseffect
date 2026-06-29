/**
 * POST /api/auth/wechat/unbind
 *
 * B-02-2：已登录用户解绑微信
 *
 * 入参:无（从 session 取 userId）
 * 返回:{ ok: true }
 *
 * 安全策略:
 *   1. 鉴权（必须已登录）
 *   2. 用户必须已绑定微信
 *   3. **关键**：用户必须已绑定手机号或设置了密码，否则解绑后无法登录
 *      - 有 phone → 可通过手机号验证码登录
 *      - 有 password → 可通过账号密码登录
 *      - 两者都没有 → 拒绝解绑
 *
 * 错误:
 *   401 — 未登录
 *   400 — 未绑定微信 / 解绑后无登录方式
 *   500 — 其他异常
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, wechatOpenId: true, phone: true, password: true },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    if (!user.wechatOpenId) {
      return NextResponse.json({ error: "您尚未绑定微信" , code: "NOT_BOUND" }, { status: 400 });
    }

    // 安全检查：解绑后必须有其他登录方式
    if (!user.phone && !user.password) {
      return NextResponse.json(
        {
          error: "解绑微信后您将无法登录（账号未绑定手机号也未设置密码）。请先绑定手机号或设置密码。",
          code: "NO_OTHER_LOGIN",
        },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { wechatOpenId: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[wechat/unbind] 解绑失败:", err);
    return NextResponse.json({ error: "解绑失败，请稍后重试" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
