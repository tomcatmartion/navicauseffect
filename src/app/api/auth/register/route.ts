import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { generateInviteCode } from "@/lib/utils/invite-code";

// 邀请注册奖励星币数
const INVITER_REWARD = 20; // 邀请人获得
const INVITEE_REWARD = 10; // 被邀请人获得

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
    const inviteCodeParam = typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "用户名长度需要3-20个字符" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "用户名只能包含字母、数字和下划线" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少6位" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "该用户名已被注册" },
        { status: 409 }
      );
    }

    // 验证邀请码（如果提供了）
    let inviter = null;
    if (inviteCodeParam) {
      inviter = await prisma.user.findUnique({ where: { inviteCode: inviteCodeParam } });
      if (!inviter) {
        return NextResponse.json(
          { error: "邀请码无效" },
          { status: 400 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    let inviteCode = generateInviteCode();
    const maxInviteRetries = 5;

    for (let attempt = 0; attempt < maxInviteRetries; attempt++) {
      try {
        const user = await prisma.user.create({
          data: {
            username,
            password: hashedPassword,
            nickname: nickname || username,
            inviteCode,
            totalPoints: inviter ? INVITEE_REWARD : 0, // 被邀请人获得初始星币
            membership: { create: { plan: "FREE", status: "ACTIVE" } },
          },
        });

        // 处理邀请奖励
        if (inviter) {
          await prisma.$transaction([
            // 邀请人获得星币
            prisma.user.update({
              where: { id: inviter.id },
              data: { totalPoints: { increment: INVITER_REWARD } },
            }),
            prisma.pointRecord.create({
              data: {
                userId: inviter.id,
                points: INVITER_REWARD,
                source: "INVITE",
                detail: `邀请用户 ${username} 注册奖励`,
              },
            }),
            // 被邀请人记录流水
            prisma.pointRecord.create({
              data: {
                userId: user.id,
                points: INVITEE_REWARD,
                source: "INVITE",
                detail: `使用邀请码注册奖励`,
              },
            }),
          ]);

          // 更新或创建推广员档案
          let promoterProfileId: string;
          const existingProfile = await prisma.promoterProfile.findUnique({
            where: { userId: inviter.id },
          });
          if (!existingProfile) {
            const newProfile = await prisma.promoterProfile.create({
              data: {
                userId: inviter.id,
                inviteCode: inviter.inviteCode,
                level: 1,
                totalEarned: INVITER_REWARD,
              },
            });
            promoterProfileId = newProfile.id;
          } else {
            await prisma.promoterProfile.update({
              where: { userId: inviter.id },
              data: { totalEarned: { increment: INVITER_REWARD } },
            });
            promoterProfileId = existingProfile.id;
          }

          // 记录到推广团队（promoterId 指向 PromoterProfile.id）
          await prisma.promoterTeam.create({
            data: {
              promoterId: promoterProfileId,
              memberId: user.id,
            },
          });

          // 记录推广收益（promoterId 指向 PromoterProfile.id）
          await prisma.promoterEarning.create({
            data: {
              promoterId: promoterProfileId,
              userId: user.id,
              eventType: "REGISTER",
              points: INVITER_REWARD,
            },
          });
        }

        return NextResponse.json({
          message: inviter ? `注册成功！获得${INVITEE_REWARD}星币奖励` : "注册成功",
          userId: user.id,
          bonusPoints: inviter ? INVITEE_REWARD : 0,
        });
      } catch (err: unknown) {
        const prismaError = err as { code?: string; meta?: { target?: string[] } };
        if (prismaError?.code === "P2002" && prismaError?.meta?.target?.includes("invite_code")) {
          inviteCode = generateInviteCode();
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);

    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError?.code === "P2002") {
      const target = prismaError.meta?.target as string[] | undefined;
      if (target?.includes("username")) {
        return NextResponse.json(
          { error: "该用户名已被注册" },
          { status: 409 }
        );
      }
    }

    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "注册失败，请稍后重试";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
