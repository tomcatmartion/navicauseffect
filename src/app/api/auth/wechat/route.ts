import { NextResponse } from "next/server";

export async function GET() {
  const appId = process.env.WECHAT_APP_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXTAUTH_URL}/api/auth/wechat/callback`
  );

  if (!appId) {
    return NextResponse.json(
      { error: "微信登录未配置", configured: false },
      { status: 503 }
    );
  }

  const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`;

  return NextResponse.json({ url: wechatUrl, configured: true });
}
