"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex min-h-screen">
      {/* 桌面端侧边栏 */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-56 border-r border-border bg-card md:block">
        <div className="flex h-16 items-center border-b px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground font-bold">
              管
            </div>
            <span className="font-semibold">管理后台</span>
          </Link>
        </div>
        <nav className="space-y-1 p-3">
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <i className={`ti ${item.icon}`} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 w-full px-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <i className="ti ti-arrow-left" /> 返回前台
          </Link>
        </div>
      </aside>

      {/* 移动端抽屉遮罩 */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* 移动端侧边抽屉 */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 border-r border-border bg-card transition-transform duration-200 md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/admin" className="flex items-center gap-2" onClick={() => setDrawerOpen(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground font-bold">
              管
            </div>
            <span className="font-semibold">管理后台</span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <nav className="space-y-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 120px)" }}>
          {adminNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === item.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <i className={`ti ${item.icon}`} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 w-full border-t px-3 pt-3">
          <Link
            href="/"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <i className="ti ti-arrow-left" /> 返回前台
          </Link>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 md:ml-56">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-card/80 px-4 backdrop-blur-sm md:px-6">
          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="mr-3 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          >
            <i className="ti ti-menu-2" />
          </button>
          <h1 className="text-base font-semibold md:text-lg">微著 · 管理后台</h1>
          {/* 移动端返回前台快捷入口 */}
          <Link
            href="/"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground md:hidden"
          >
            返回前台 →
          </Link>
        </header>
        <div className="admin-page p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
