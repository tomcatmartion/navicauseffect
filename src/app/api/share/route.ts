import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_PLATFORMS = new Set([
  "WECHAT",
  "MOMENTS",
  "WEIBO",
  "QQ",
  "LINK",
  "QRCODE",
  "REDBOOK",
  "ZHIHU",
]);

/** 每次有效分享奖励星币 */
const SHARE_REWARD_POINTS = 1;
/** 每日分享奖励上限（防止刷币） */
const DAILY_SHARE_LIMIT = 10;

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
    const { platform, shareUrl } = body as {
      platform?: string;
      shareUrl?: string;
      channel?: string;
    };

    // channel 是旧字段名（向后兼容），platform 是新字段名
    const rawPlatform = platform ?? (body as { channel?: string })?.channel ?? "WECHAT";
    const normalizedPlatform = rawPlatform.toUpperCase();
    if (!VALID_PLATFORMS.has(normalizedPlatform)) {
      return NextResponse.json({ error: "无效的分享平台" }, { status: 400 });
    }

    // 检查每日分享上限（仅对奖励计数生效，不阻塞记录）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const todayShares = await prisma.shareRecord.count({
      where: {
        userId: session.user.id,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    const rewardEligible = todayShares < DAILY_SHARE_LIMIT;
    const rewardPoints = rewardEligible ? SHARE_REWARD_POINTS : 0;

    // 1. 记录分享
    const shareRecord = await prisma.shareRecord.create({
      data: {
        userId: session.user.id,
        platform: normalizedPlatform as "WECHAT" | "MOMENTS" | "WEIBO" | "QQ" | "LINK" | "QRCODE" | "REDBOOK" | "ZHIHU",
        shareUrl: shareUrl ?? "",
        rewardPoints,
      },
    });

    // 2. 发放奖励（事务保证原子性）
    if (rewardPoints > 0) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.user.id },
          data: { totalPoints: { increment: rewardPoints } },
        }),
        prisma.pointRecord.create({
          data: {
            userId: session.user.id,
            points: rewardPoints,
            source: "SHARE",
            detail: `分享到${getPlatformLabel(normalizedPlatform)}`,
          },
        }),
      ]);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totalPoints: true },
    });

    return NextResponse.json({
      shareId: shareRecord.id,
      reward: rewardPoints,
      totalPoints: user?.totalPoints ?? 0,
      limitRemaining: Math.max(0, DAILY_SHARE_LIMIT - todayShares - 1),
      message: rewardEligible
        ? `分享成功，+${rewardPoints} 星币`
        : `今日分享已达上限（${DAILY_SHARE_LIMIT} 次/天），不再奖励`,
    });
  } catch (error) {
    console.error("Share error:", error);
    return NextResponse.json({ error: "分享记录失败" }, { status: 500 });
  }
}

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    WECHAT: "微信好友",
    MOMENTS: "朋友圈",
    WEIBO: "微博",
    QQ: "QQ",
    LINK: "复制链接",
    QRCODE: "二维码",
    REDBOOK: "小红书",
    ZHIHU: "知乎",
  };
  return labels[platform] ?? platform;
}
