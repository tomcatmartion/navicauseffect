"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * H5 移动端底部 Tabbar（5 项）。
 * DOM 与 testUI/h5/*.html 的 <nav class="h5-tabbar"> 完全一致，
 * CSS 来自 src/styles/ziwei/ziwei.css 的 .h5-tabbar / .h5-tab。
 *
 * 桌面端（md 以上）由 rail 替代，本组件 flex md:hidden。
 */

interface TabItem {
  href: string;
  label: string;
  icon: string;
  match: "exact" | "prefix";
}

const TABS: TabItem[] = [
  { href: "/", label: "首页", icon: "ti-home", match: "exact" },
  { href: "/chart", label: "对话", icon: "ti-message-2", match: "prefix" },
  { href: "/charts", label: "命盘", icon: "ti-clipboard-list", match: "prefix" },
  { href: "/reports", label: "报告", icon: "ti-file-text", match: "prefix" },
  { href: "/profile", label: "我的", icon: "ti-user", match: "prefix" },
];

function isTabActive(tab: TabItem, pathname: string): boolean {
  if (tab.match === "exact") return pathname === tab.href;
  if (tab.href === "/chart") {
    return pathname === "/chart" || pathname.startsWith("/chart?");
  }
  // 「我的」同时匹配 /profile 和 /user（profile 是 user 的合并目标）
  if (tab.href === "/profile") {
    return (
      pathname === "/profile" ||
      pathname.startsWith("/profile/") ||
      pathname === "/user" ||
      pathname.startsWith("/user/")
    );
  }
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav className="h5-tabbar flex md:hidden" aria-label="移动端主导航">
      {TABS.map((tab) => {
        const active = isTabActive(tab, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`h5-tab${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <i className={`ti ${tab.icon}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
