/**
 * POST /api/auth/register
 *
 * 手机号注册(替代旧版用户名+密码注册)
 *
 * 入参:{ phone, code, inviteCode? }
 * 流程:
 *   1. 校验 phone 格式
 *   2. 校验验证码(从 Redis 取,sms.ts verifyCode)
 *   3. 检查 phone 不重复
 *   4. 创建 User(无 password 无 username,只有 phone + inviteCode + membership FREE)
 *   5. 触发邀请奖励(processInviteReward)
 *   6. 返回 { userId, bonusPoints } — 前端拿到后走 phone provider 自动登录
 *
 * 向后兼容:旧 username+password 账号(admin/ffffff)通过 credentials provider 登录,本接口不再处理
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateUniqueInviteCode } from "@/lib/utils/invite-code";
import { processInviteReward, INVITEE_REWARD } from "@/lib/auth/invite-reward";
import { checkCode } from "@/lib/sms";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
    }

    const { phone, code, inviteCode } = body as {
      phone?: string;
      code?: string;
      inviteCode?: string;
    };

    // 1. 校验 phone 格式
    if (!phone || typeof phone !== "string" || !PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: "手机号格式不合法" }, { status: 400 });
    }

    // 2. 校验验证码(用 checkCode 不删除 code,让 phone provider 后续能复用)
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "验证码不能为空" }, { status: 400 });
    }
    const codeValid = await checkCode(phone, code);
    if (!codeValid) {
      return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
    }

    // 3. 检查 phone 不重复
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "该手机号已注册,请直接登录" }, { status: 409 });
    }

    // 4. 邀请码校验(如果提供了)
    const inviteCodeParam =
      typeof inviteCode === "string" && inviteCode.trim()
        ? inviteCode.trim().toUpperCase()
        : "";
    let inviter: { id: string } | null = null;
    if (inviteCodeParam) {
      inviter = await prisma.user.findUnique({
        where: { inviteCode: inviteCodeParam },
        select: { id: true },
      });
      if (!inviter) {
        return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
      }
    }

    // 5. 创建用户(手机号注册无 password 无 username)
    const newInviteCode = await generateUniqueInviteCode();
    const user = await prisma.user.create({
      data: {
        phone,
        nickname: `用户${phone.slice(-4)}`,
        inviteCode: newInviteCode,
        totalPoints: inviter ? INVITEE_REWARD : 0,
        membership: { create: { plan: "FREE", status: "ACTIVE" } },
      },
    });

    // 6. 邀请奖励(共用 processInviteReward,3 个注册入口一致)
    if (inviter) {
      try {
        await processInviteReward({
          inviterId: inviter.id,
          newUserId: user.id,
          newUsername: user.nickname ?? undefined,
        });
      } catch (err) {
        // 邀请奖励失败不阻断注册流程,记录日志即可
        console.error("[register] processInviteReward 失败:", err);
      }
    }

    return NextResponse.json({
      message: inviter ? `注册成功!获得${INVITEE_REWARD}星币奖励` : "注册成功",
      userId: user.id,
      bonusPoints: inviter ? INVITEE_REWARD : 0,
    });
  } catch (error: unknown) {
    console.error("Registration error:", error);

    // Prisma 唯一约束冲突(并发场景)
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError?.code === "P2002") {
      const target = prismaError.meta?.target as string[] | undefined;
      if (target?.includes("phone")) {
        return NextResponse.json({ error: "该手机号已注册" }, { status: 409 });
      }
    }

    return NextResponse.json({ error: "注册失败,请稍后重试" }, { status: 500 });
  }
}
