import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  classifyRoute,
  buildLoginRedirectUrl,
} from "@/lib/auth/access-policy";

/**
 * 路由级权限守卫(middleware,edge runtime)
 *
 * 三层模型:
 *   L0 公开(/ /chart /pricing /auth/*)— 不进入 middleware
 *   L1 需登录(/profile /settings /charts /reports /promoter /compatibility /user)
 *       未登录 → 308 redirect /auth/login?callbackUrl=xxx
 *   L2 需管理员(/admin/*)
 *       未登录 → 308 redirect /auth/login
 *       已登录非 admin → 308 redirect /
 *
 * 注意:middleware 仅读 NextAuth token(session.user.role 来自 JWT),
 * 不直接 import Prisma/redis,避免破坏 edge bundle。
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const tier = classifyRoute(pathname);

  // L0 公开:直接放行
  if (tier === "public") {
    return NextResponse.next();
  }

  // L1 需登录:未登录 → /auth/login
  if (tier === "protected") {
    if (!req.auth) {
      const loginUrl = new URL(buildLoginRedirectUrl(pathname, search), req.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // L2 需管理员:未登录 → /auth/login;已登录非 admin → /
  if (tier === "admin") {
    if (!req.auth) {
      const loginUrl = new URL(
        buildLoginRedirectUrl(pathname, search),
        req.url,
      );
      return NextResponse.redirect(loginUrl);
    }
    if (req.auth?.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  /**
   * matcher 必须是字面量数组 (Next.js 16 静态分析要求,不能用函数调用)。
   * 数值与 access-policy.ts 的 PROTECTED_ROUTES + ADMIN_ROUTES 派生结果一致,
   * 改动路径分类时需同步本数组。
   */
  matcher: [
    // L1 需登录
    "/profile",
    "/profile/:path*",
    "/settings",
    "/settings/:path*",
    "/user",
    "/user/:path*",
    "/charts",
    "/charts/:path*",
    "/reports",
    "/reports/:path*",
    "/promoter",
    "/promoter/:path*",
    "/compatibility",
    "/compatibility/:path*",
    // L2 需管理员
    "/admin",
    "/admin/:path*",
  ],
};
