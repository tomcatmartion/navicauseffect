import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const { platform, shareUrl } = await request.json();

    await prisma.shareRecord.create({
      data: {
        userId: session.user.id,
        platform: platform || "WECHAT",
        shareUrl: shareUrl || "",
      },
    });

    await prisma.pointRecord.create({
      data: {
        userId: session.user.id,
        points: 1,
        source: "SHARE",
        detail: `分享到${platform === "MOMENTS" ? "朋友圈" : "微信好友"}`,
      },
    });

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { totalPoints: { increment: 1 } },
    });

    if (user.totalPoints > 0 && user.totalPoints % 10 === 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { bonusQueries: { increment: 1 } },
      });

      await prisma.pointRecord.create({
        data: {
          userId: session.user.id,
          points: -10,
          source: "REDEEM",
          detail: "10积分兑换1次免费测算",
        },
      });
    }

    return NextResponse.json({
      points: user.totalPoints,
      message: "分享成功，+1 积分",
    });
  } catch (error) {
    console.error("Share error:", error);
    return NextResponse.json({ error: "分享记录失败" }, { status: 500 });
  }
}
