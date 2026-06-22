/**
 * POST /api/auth/wechat-miniprogram
 *
 * 微信小程序专用登录端点。
 *
 * 流程：
 *   code → jscode2session → openid → 查/建 User → 签发独立 JWT
 *
 * 与 NextAuth session 完全独立：
 *   - 不写 httpOnly cookie
 *   - 返回 { token, user }，小程序存 localStorage
 *   - 后续请求带 Authorization: Bearer <token>
 *
 * mock 模式（默认）：WECHAT_MINIPROGRAM_APP_ID 未配置时
 *   返回 fake openid，可独立测试
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jscode2session, isMiniprogramMockMode } from "@/lib/wechat-miniprogram";
import { signMiniprogramToken } from "@/lib/jwt-miniprogram";
import { generateUniqueInviteCode } from "@/lib/utils/invite-code";

// 小程序 openid 前缀，与 H5 OAuth 的 wechatOpenId 区分（避免冲突）
const MP_OPENID_PREFIX = "mp_";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!code) {
      return NextResponse.json(
        { error: "缺少 code 参数", mockMode: isMiniprogramMockMode() },
        { status: 400 },
      );
    }

    // 1. code → openid
    let sessionInfo;
    try {
      sessionInfo = await jscode2session(code);
    } catch (err) {
      console.error("[wechat-miniprogram] jscode2session 失败:", err);
      return NextResponse.json(
        {
          error: "微信登录失败",
          detail: err instanceof Error ? err.message : String(err),
          mockMode: isMiniprogramMockMode(),
        },
        { status: 502 },
      );
    }

    // openid 加前缀，避免与 H5 OAuth 冲突
    const compositeOpenid = MP_OPENID_PREFIX + sessionInfo.openid;

    // 2. 查/建 User
    let user = await prisma.user.findFirst({
      where: { wechatOpenId: compositeOpenid },
      include: { membership: true },
    });

    if (!user) {
      // 创建新用户
      const inviteCode = await generateUniqueInviteCode();
      const displayName = sessionInfo.openid.slice(0, 8);

      user = await prisma.user.create({
        data: {
          wechatOpenId: compositeOpenid,
          username: `wx_${sessionInfo.openid.slice(0, 12)}`,
          nickname: `微信用户${displayName}`,
          inviteCode,
          membership: {
            create: { plan: "FREE", status: "ACTIVE" },
          },
        },
        include: { membership: true },
      });
      console.log(`[wechat-miniprogram] 新用户注册: ${user.id} openid=${sessionInfo.openid.slice(0, 8)}***`);
    }

    // 3. 签 JWT
    const token = await signMiniprogramToken({
      userId: user.id,
      openid: compositeOpenid,
    });

    // 4. 返回
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.nickname || user.username || "微信用户",
        nickname: user.nickname,
        username: user.username,
        membershipPlan: user.membership?.plan || "FREE",
        totalPoints: user.totalPoints,
        inviteCode: user.inviteCode,
      },
      // 调试信息（生产可考虑去掉）
      mockMode: isMiniprogramMockMode(),
    });
  } catch (err) {
    console.error("[wechat-miniprogram] 登录失败:", err);
    return NextResponse.json(
      { error: "服务器错误", mockMode: isMiniprogramMockMode() },
      { status: 500 },
    );
  }
}
