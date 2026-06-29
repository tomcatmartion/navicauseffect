"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNavItems = [
  { label: "概览", href: "/admin", icon: "ti-dashboard" },
  { label: "AI 模型", href: "/admin/models", icon: "ti-robot" },
  { label: "用户管理", href: "/admin/users", icon: "ti-users" },
  { label: "价格管理", href: "/admin/pricing", icon: "ti-cash" },
  { label: "短信网关", href: "/admin/sms", icon: "ti-message-sms" },
  { label: "支付配置", href: "/admin/payment", icon: "ti-credit-card" },
  { label: "数据统计", href: "/admin/stats", icon: "ti-chart-line" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentItem = adminNavItems.find((item) =>
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
  );

  return (
    <div className="admin-shell">
      {/* 桌面端侧边栏（移动端复用为抽屉）*/}
      <aside className={`admin-rail${drawerOpen ? " open" : ""}`}>
        <Link
          href="/admin"
          className="admin-rail-logo-box"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="admin-rail-logo">管</div>
          <span className="admin-rail-brand">微著后台</span>
        </Link>
        <nav className="admin-rail-nav">
          {adminNavItems.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`admin-rail-btn${active ? " active" : ""}`}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-rail-foot">
          <Link
            href="/"
            onClick={() => setDrawerOpen(false)}
            className="admin-rail-btn"
          >
            <i className="ti ti-arrow-left" />
            <span>返回前台</span>
          </Link>
        </div>
      </aside>

      {/* 移动端抽屉遮罩 */}
      {drawerOpen && (
        <div
          className="admin-rail-mask open"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 主内容区 */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="admin-topbar-burger"
              aria-label="打开菜单"
            >
              <i className="ti ti-menu-2" />
            </button>
            <div>
              <h1 className="admin-topbar-title">
                <i className="ti ti-shield-check" />
                <span>微著 · 管理后台</span>
              </h1>
              <div className="admin-topbar-breadcrumb">
                <Link href="/admin">后台</Link>
                <i className="ti ti-chevron-right" />
                <span>{currentItem?.label ?? "页面"}</span>
              </div>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <Link href="/" className="admin-topbar-back">
              <i className="ti ti-arrow-left" />
              <span>返回前台</span>
            </Link>
          </div>
        </header>
        <div className="admin-content admin-page">{children}</div>
      </div>
    </div>
  );
}
