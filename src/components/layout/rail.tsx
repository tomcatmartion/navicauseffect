"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * 桌面左侧导航 Rail（84px 宽）。
 * DOM 与 testUI/desktop/*.html 的 <aside class="rail"> 完全一致，
 * CSS 来自 src/styles/ziwei/ziwei.css。
 *
 * 移动端（<md）由 mobile-tabbar 替代，本组件 hidden md:flex。
 */

interface RailItem {
  href: string;
  label: string;
  icon: string;
  /** active 匹配模式：默认前缀匹配，"exact" 表示完全匹配 */
  match?: "exact" | "prefix";
}

const RAIL_ITEMS: RailItem[] = [
  { href: "/", label: "首页", icon: "ti-home", match: "exact" },
  { href: "/chart", label: "对话", icon: "ti-message-2", match: "prefix" },
  { href: "/charts", label: "命盘", icon: "ti-clipboard-list", match: "prefix" },
  { href: "/reports", label: "报告", icon: "ti-file-text", match: "prefix" },
  { href: "/compatibility", label: "合盘", icon: "ti-hearts", match: "prefix" },
  { href: "/pricing", label: "会员", icon: "ti-crown", match: "prefix" },
];

function isItemActive(item: RailItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href;
  // prefix 模式：/chart 会同时匹配 /chart 与 /charts，需要更精确
  if (item.href === "/chart") {
    return pathname === "/chart" || pathname.startsWith("/chart?");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const PLAN_LABELS: Record<string, string> = {
  FREE: "普通用户",
  MONTHLY: "月度会员",
  QUARTERLY: "季度会员",
  YEARLY: "年度会员",
};

export function Rail() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const initial = (user?.name?.charAt(0) || (isLoggedIn ? "U" : "访"));

  return (
    <aside className="rail hidden md:flex" aria-label="主导航">
      <Link
        href={isLoggedIn ? "/" : "/auth/login"}
        className="rail-logo"
        aria-label="返回首页"
      >
        微
      </Link>

      {RAIL_ITEMS.map((item) => {
        const active = isItemActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rail-btn${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <i className={`ti ${item.icon}`} />
            <span className="rail-label">{item.label}</span>
          </Link>
        );
      })}

      <div className="rail-spacer" />

      {isLoggedIn ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rail-avatar"
              aria-label="用户菜单"
              title={user?.name || "用户"}
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-48">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name || "用户"}</p>
              <p className="text-xs text-muted-foreground">
                {PLAN_LABELS[user?.membershipPlan || "FREE"]}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">个人中心</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/charts">我的命盘</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/reports">我的报告</Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin">管理后台</Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-destructive focus:text-destructive"
            >
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link
          href="/auth/login"
          className="rail-avatar"
          aria-label="登录"
          title="登录"
        >
          <i className="ti ti-user" style={{ fontSize: 18 }} />
        </Link>
      )}
    </aside>
  );
}
