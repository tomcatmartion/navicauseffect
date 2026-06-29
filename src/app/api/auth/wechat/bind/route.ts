/**
 * POST /api/auth/wechat/bind
 *
 * B-02：已登录用户绑定微信（H5 OAuth code → 拿 openid → 写入 user.wechatOpenId）
 *
 * 入参:{ code: string }  // 微信 OAuth redirect 后返回的 code
 * 返回:{ ok: true, nickname?: string, avatar?: string }
 *
 * 流程:
 *   1. 鉴权（必须已登录，session.user.id 存在）
 *   2. 调用微信 sns/oauth2/access_token 拿 openid
 *   3. 调用 sns/userinfo 拿昵称、头像（可选）
 *   4. 校验 openid 未被其他用户绑定
 *   5. 更新当前 user 的 wechatOpenId + 昵称/头像（如用户尚未有）
 *   6. 返回成功
 *
 * mock 模式（WECHAT_APP_ID 未配置）：
 *   不实际调微信 API，生成 mock openid `mock_<userId>_<timestamp>`
 *   便于开发环境验证绑定流程
 *
 * 错误:
 *   401 — 未登录
 *   400 — code 缺失 / 微信 API 错误
 *   409 — 该微信已绑定其他账号
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const WECHAT_APP_ID = process.env.WECHAT_APP_ID;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET;

export async function POST(request: NextRequest) {
  // 1. 鉴权
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }
  const { code } = body as { code?: string };
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "缺少微信授权码" }, { status: 400 });
  }

  // 2. 已绑定检查
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, wechatOpenId: true, phone: true },
  });
  if (!currentUser) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  if (currentUser.wechatOpenId) {
    return NextResponse.json({ error: "您已绑定微信，请先解绑" , code: "ALREADY_BOUND" }, { status: 409 });
  }

  try {
    let openid: string;
    let wxNickname: string | undefined;
    let wxAvatar: string | undefined;

    // 3. 调用微信 OAuth（mock 模式生成假 openid）
    if (WECHAT_APP_ID && WECHAT_APP_SECRET) {
      const tokenRes = await fetch(
        `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${WECHAT_APP_ID}&secret=${WECHAT_APP_SECRET}&code=${code}&grant_type=authorization_code`,
      );
      const tokenData = await tokenRes.json();
      if (tokenData.errcode) {
        console.error("[wechat/bind] token error:", tokenData);
        return NextResponse.json({ error: `微信授权失败：${tokenData.errmsg || tokenData.errcode}` }, { status: 400 });
      }
      openid = tokenData.openid;
      const accessToken = tokenData.access_token;

      // 拿昵称头像
      const userInfoRes = await fetch(
        `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}&lang=zh_CN`,
      );
      const wxUser = await userInfoRes.json();
      wxNickname = wxUser.nickname;
      wxAvatar = wxUser.headimgurl;
    } else {
      // mock 模式
      openid = `mock_${userId}_${Date.now()}`;
      wxNickname = "微信用户（模拟）";
      console.warn("[wechat/bind] mock 模式：未配置 WECHAT_APP_ID，使用假 openid", openid);
    }

    // 4. 校验 openid 未被其他账号绑定
    const existingUser = await prisma.user.findUnique({
      where: { wechatOpenId: openid },
      select: { id: true },
    });
    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json({ error: "该微信已绑定其他账号，请先在那个账号上解绑", code: "OPENID_TAKEN" }, { status: 409 });
    }

    // 5. 更新当前 user
    await prisma.user.update({
      where: { id: userId },
      data: {
        wechatOpenId: openid,
        ...(wxNickname ? { nickname: wxNickname } : {}),
        ...(wxAvatar ? { avatar: wxAvatar } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      nickname: wxNickname,
      avatar: wxAvatar,
      mock: !WECHAT_APP_ID,
    });
  } catch (err) {
    console.error("[wechat/bind] 绑定失败:", err);
    return NextResponse.json({ error: "绑定失败，请稍后重试" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
