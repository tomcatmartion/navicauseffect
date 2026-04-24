import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=wechat_denied", request.url));
  }

  const loginUrl = new URL("/auth/login", request.url);
  loginUrl.searchParams.set("wechat_code", code);

  return NextResponse.redirect(loginUrl);
}
