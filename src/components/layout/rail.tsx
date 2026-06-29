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
  { href: "/promoter", label: "推广", icon: "ti-megaphone", match: "prefix" },
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
          <DropdownMenuContent align="end" side="right" className="user-menu">
            <div className="user-menu-header">
              <div className="user-menu-avatar">{initial}</div>
              <div>
                <p className="user-menu-name">{user?.name || "用户"}</p>
                <p className="user-menu-plan">
                  {PLAN_LABELS[user?.membershipPlan || "FREE"]}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="user-menu-item">
                <i className="ti ti-user" />
                <span>个人中心</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/charts" className="user-menu-item">
                <i className="ti ti-clipboard-list" />
                <span>我的命盘</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/reports" className="user-menu-item">
                <i className="ti ti-file-text" />
                <span>我的报告</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="user-menu-item">
                <i className="ti ti-settings" />
                <span>账户设置</span>
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="user-menu-item">
                    <i className="ti ti-shield-check" />
                    <span>管理后台</span>
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="user-menu-item danger"
            >
              <i className="ti ti-logout" />
              <span>退出登录</span>
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
