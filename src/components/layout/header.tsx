"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首页", href: "/" },
  { label: "命理排盘", href: "/chart" },
  { label: "会员", href: "/pricing" },
];

const PLAN_LABELS: Record<string, string> = {
  FREE: "普通用户",
  MONTHLY: "月度会员",
  QUARTERLY: "季度会员",
  YEARLY: "年度会员",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const isLoggedIn = status === "authenticated" && !!session?.user;
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const isPremium =
    user?.membershipPlan === "MONTHLY" ||
    user?.membershipPlan === "QUARTERLY" ||
    user?.membershipPlan === "YEARLY";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl">
            ☯
          </div>
          <span className="hidden text-lg font-semibold text-primary font-[var(--font-serif-sc)] sm:block">
            紫微心理
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          ) : isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-muted focus:outline-none min-h-[44px]">
                  <div className="flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {user?.name?.charAt(0) || "U"}
                  </div>
                  <span className="hidden max-w-[100px] truncate text-foreground sm:block">
                    {user?.name || "用户"}
                  </span>
                  {isPremium && (
                    <Badge variant="outline" className="hidden border-amber-400 text-amber-600 text-[10px] px-1.5 py-0 sm:inline-flex">
                      {PLAN_LABELS[user?.membershipPlan || "FREE"]}
                    </Badge>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name || "用户"}</p>
                  <p className="text-xs text-muted-foreground">
                    {PLAN_LABELS[user?.membershipPlan || "FREE"]}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/chart")}>
                  开始排盘
                </DropdownMenuItem>
                {!isPremium && (
                  <DropdownMenuItem onClick={() => router.push("/pricing")}>
                    开通会员
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/admin")}>
                      管理后台
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
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  登录
                </Button>
              </Link>
              <Link href="/chart">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  开始排盘
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
