import { NextResponse } from "next/server";

/**
 * GET /api/auth/wechat
 *
 * 返回微信扫码登录 URL。
 *
 * 开发演示模式(B 方案):
 *   即使 WECHAT_APP_ID 未配置,也返回 configured: true 让前端显示「微信扫码登录」按钮。
 *   点击时前端检测 mock 字段:mock=true 则显示提示(不跳转到无效 URL),等真实配置就位。
 *
 * 生产模式:
 *   WECHAT_APP_ID 配置后,mock=false,url 是真实微信开放平台扫码 URL。
 */
export async function GET() {
  const appId = process.env.WECHAT_APP_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXTAUTH_URL}/api/auth/wechat/callback`,
  );

  // 开发演示模式:未配置也显示按钮,但 mock=true 让前端提示用户
  if (!appId) {
    return NextResponse.json({
      configured: true,
      mock: true,
      message: "WECHAT_APP_ID 未配置,开发演示模式",
    });
  }

  const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`;

  return NextResponse.json({
    url: wechatUrl,
    configured: true,
    mock: false,
  });
}
