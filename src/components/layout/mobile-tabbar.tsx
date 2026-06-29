"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * H5 移动端底部 Tabbar（5 项常驻 + 1 项更多抽屉）。
 * DOM 与 testUI/h5/*.html 的 <nav class="h5-tabbar"> 基本一致，
 * CSS 来自 src/styles/ziwei/ziwei.css 的 .h5-tabbar / .h5-tab。
 *
 * B-14：常驻保留首页/对话/命盘/报告/我的；「更多」抽屉聚合合盘/会员/推广/设置，
 * 使移动用户在 2 次点击内可达所有核心功能。
 *
 * 桌面端（md 以上）由 rail 替代，本组件 flex md:hidden。
 */

interface TabItem {
  href: string;
  label: string;
  icon: string;
  match: "exact" | "prefix";
}

const MAIN_TABS: TabItem[] = [
  { href: "/", label: "首页", icon: "ti-home", match: "exact" },
  { href: "/chart", label: "对话", icon: "ti-message-2", match: "prefix" },
  { href: "/charts", label: "命盘", icon: "ti-clipboard-list", match: "prefix" },
  { href: "/reports", label: "报告", icon: "ti-file-text", match: "prefix" },
  { href: "/profile", label: "我的", icon: "ti-user", match: "prefix" },
];

const MORE_ITEMS: Array<{ href: string; label: string; icon: string; desc: string }> = [
  { href: "/compatibility", label: "双人合盘", icon: "ti-hearts", desc: "两人命盘互动分析" },
  { href: "/pricing", label: "会员充值", icon: "ti-crown", desc: "开通会员 / 购买星币" },
  { href: "/promoter", label: "推广得币", icon: "ti-megaphone", desc: "邀请好友赚星币" },
  { href: "/settings", label: "偏好设置", icon: "ti-settings", desc: "主题与账户设置" },
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

function isMoreActive(pathname: string): boolean {
  return MORE_ITEMS.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function MobileTabbar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="h5-tabbar flex md:hidden" aria-label="移动端主导航">
        {MAIN_TABS.map((tab) => {
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
        {/* B-14：更多抽屉 */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={`h5-tab${isMoreActive(pathname) ? " active" : ""}`}
              aria-label="更多功能"
            >
              <i className="ti ti-layout-grid" />
              <span>更多</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto rounded-t-[var(--radius-lg)] pb-8">
            <SheetHeader>
              <SheetTitle className="text-left" style={{ fontSize: 16, color: "var(--brand)" }}>
                更多功能
              </SheetTitle>
            </SheetHeader>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 16 }}>
              {MORE_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    background: "var(--panel)",
                    border: "1px solid var(--line-light)",
                    borderRadius: "var(--radius-sm)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--soft)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--brand)",
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <i className={`ti ${item.icon}`} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.desc}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}
