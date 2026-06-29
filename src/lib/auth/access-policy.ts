/**
 * 访问权限分层常量(middleware + 客户端 redirect 共用)
 *
 * 三层模型:
 *   L0 公开    — 游客可用,业务 API 内部限额
 *   L1 需登录  — middleware 守卫,未登录 → 308 redirect /auth/login
 *   L2 需管理员 — middleware 守卫,非 admin → 308 redirect /
 *
 * 改动路径分类时,只需更新本文件,middleware 自动适配。
 */

/** L0 公开路径(游客可用,达到业务限额引导注册) */
export const PUBLIC_ROUTES = [
  "/",
  "/chart",
  "/pricing",
  "/auth/login",
  "/auth/bind-phone",
] as const;

/** L1 需登录路径(精确匹配,带子路径的需要在 matcher 中加 :path*) */
export const PROTECTED_ROUTES = [
  "/profile",
  "/settings",
  "/user",
  "/charts",
  "/reports",
  "/promoter",
  "/compatibility",
] as const;

/** L2 需管理员路径(前缀匹配,/admin/* 都属于此类) */
export const ADMIN_ROUTES = ["/admin"] as const;

/** 路由层级 */
export type RouteTier = "public" | "protected" | "admin";

/**
 * 路径分类
 *
 * 优先级:admin > protected > public
 *   /admin → admin
 *   /admin/users → admin(前缀)
 *   /profile → protected
 *   /profile/edit → protected(前缀,由 matcher 派生)
 *   /chart → public
 *   / unknown → public(默认开放,避免误锁)
 */
export function classifyRoute(pathname: string): RouteTier {
  // L2 管理员:精确或前缀
  for (const route of ADMIN_ROUTES) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return "admin";
    }
  }
  // L1 需登录:精确或前缀
  for (const route of PROTECTED_ROUTES) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      return "protected";
    }
  }
  // 默认 L0 公开
  return "public";
}

/**
 * 派生 Next.js middleware matcher 配置
 *
 * 包含所有 PROTECTED + ADMIN 路径及其子路径,
 * middleware 只对这些路径生效,公开路径不进入 middleware(性能优化)
 */
export function deriveMiddlewareMatcher(): string[] {
  const matchers: string[] = [];
  for (const route of [...PROTECTED_ROUTES, ...ADMIN_ROUTES]) {
    // 精确匹配 + 子路径
    matchers.push(route);
    matchers.push(`${route}/:path*`);
  }
  return matchers;
}

/**
 * 构造登录跳转 URL(带 callbackUrl)
 */
export function buildLoginRedirectUrl(
  pathname: string,
  search: string = "",
): string {
  const callbackUrl = search ? `${pathname}${search}` : pathname;
  return `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
