import { prisma } from "@/lib/db";

/**
 * 邀请注册奖励配置
 *
 * 这两个常量在 register/route.ts / wechat/route.ts / wechat-miniprogram/route.ts
 * 三处注册流程中保持一致。改动时需同步检查测试用例。
 */
export const INVITER_REWARD = 20; // 邀请人获得星币
export const INVITEE_REWARD = 10; // 被邀请人获得星币

type ProcessInviteRewardParams = {
  /** 邀请人 user.id */
  inviterId: string;
  /** 新注册用户 user.id */
  newUserId: string;
  /** 新注册用户名（用于流水说明） */
  newUsername?: string;
};

type ProcessInviteRewardResult =
  | { ok: true; inviterPoints: number; inviteePoints: number }
  | { ok: false; reason: "self_invite" | "already_in_team" };

/**
 * 处理邀请奖励的完整流程（3 个注册入口共用）：
 *
 * 1. 校验：邀请人 ≠ 新用户；不能重复入团
 * 2. 给邀请人 +INVITER_REWARD 星币 + PointRecord
 * 3. 给被邀请人 +INVITEE_REWARD 星币 + PointRecord
 * 4. upsert PromoterProfile（邀请人的推广员档案）
 * 5. 创建 PromoterTeam（团长 = 邀请人的 PromoterProfile，memberId = 新用户）
 * 6. 创建 PromoterEarning（eventType=REGISTER，points=INVITER_REWARD）
 *
 * 使用事务保证原子性。失败时抛出异常由调用方处理。
 */
export async function processInviteReward(
  params: ProcessInviteRewardParams
): Promise<ProcessInviteRewardResult> {
  const { inviterId, newUserId, newUsername } = params;

  // 防自身邀请
  if (inviterId === newUserId) {
    return { ok: false, reason: "self_invite" };
  }

  // 防重复入团（同一新人只能被邀请一次）
  const existingTeam = await prisma.promoterTeam.findFirst({
    where: { memberId: newUserId },
    select: { id: true },
  });
  if (existingTeam) {
    return { ok: false, reason: "already_in_team" };
  }

  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: { id: true, inviteCode: true },
  });
  if (!inviter) {
    throw new Error(`邀请人不存在：${inviterId}`);
  }

  // 1. 加星币 + 流水（事务）
  await prisma.$transaction([
    prisma.user.update({
      where: { id: inviterId },
      data: { totalPoints: { increment: INVITER_REWARD } },
    }),
    prisma.user.update({
      where: { id: newUserId },
      data: { totalPoints: { increment: INVITEE_REWARD } },
    }),
    prisma.pointRecord.create({
      data: {
        userId: inviterId,
        points: INVITER_REWARD,
        source: "INVITE",
        detail: `邀请用户 ${newUsername ?? newUserId.slice(0, 8)} 注册奖励`,
      },
    }),
    prisma.pointRecord.create({
      data: {
        userId: newUserId,
        points: INVITEE_REWARD,
        source: "INVITE",
        detail: "使用邀请码注册奖励",
      },
    }),
  ]);

  // 2. upsert PromoterProfile（邀请人的推广员档案）
  const existingProfile = await prisma.promoterProfile.findUnique({
    where: { userId: inviterId },
  });
  let promoterProfileId: string;
  if (!existingProfile) {
    const newProfile = await prisma.promoterProfile.create({
      data: {
        userId: inviterId,
        inviteCode: inviter.inviteCode,
        level: 1,
        totalEarned: INVITER_REWARD,
      },
    });
    promoterProfileId = newProfile.id;
  } else {
    await prisma.promoterProfile.update({
      where: { userId: inviterId },
      data: { totalEarned: { increment: INVITER_REWARD } },
    });
    promoterProfileId = existingProfile.id;
  }

  // 3. 创建团队关系 + 推广收益
  await prisma.$transaction([
    prisma.promoterTeam.create({
      data: {
        promoterId: promoterProfileId,
        memberId: newUserId,
      },
    }),
    prisma.promoterEarning.create({
      data: {
        promoterId: promoterProfileId,
        userId: newUserId,
        eventType: "REGISTER",
        points: INVITER_REWARD,
      },
    }),
  ]);

  return { ok: true, inviterPoints: INVITER_REWARD, inviteePoints: INVITEE_REWARD };
}
