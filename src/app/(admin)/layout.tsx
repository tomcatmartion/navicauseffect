"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { label: "概览", href: "/admin", icon: "📊" },
  { label: "AI 模型", href: "/admin/models", icon: "🤖" },
  { label: "Embedding", href: "/admin/embedding", icon: "🧬" },
  { label: "知识库", href: "/admin/knowledge-base", icon: "📚" },
  { label: "标签管理", href: "/admin/tags", icon: "🏷" },
  { label: "RAG 测试", href: "/admin/rag-test", icon: "🔍" },
  { label: "Prompt 配置", href: "/admin/prompts", icon: "📝" },
  { label: "收费模块", href: "/admin/modules", icon: "📋" },
  { label: "用户管理", href: "/admin/users", icon: "👥" },
  { label: "价格管理", href: "/admin/pricing", icon: "💰" },
  { label: "短信网关", href: "/admin/sms", icon: "📱" },
  { label: "支付配置", href: "/admin/payment", icon: "💳" },
  { label: "数据统计", href: "/admin/stats", icon: "📈" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
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
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 w-full px-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            ← 返回前台
          </Link>
        </div>
      </aside>

      <main className="flex-1 md:ml-56">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-card/80 px-6 backdrop-blur-sm">
          <h1 className="text-lg font-semibold">紫微心理 · 管理后台</h1>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
