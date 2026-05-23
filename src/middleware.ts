import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const protectedPaths = ["/profile", "/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // 未登录 → 重定向到登录页
  if (isProtected && !req.auth) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 管理后台路径 → 额外校验 ADMIN 角色
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminPath && req.auth?.user?.role !== "ADMIN") {
    // 非管理员尝试访问后台 → 重定向到首页（或 403 页面）
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/profile", "/profile/:path*", "/admin", "/admin/:path*"],
};
