"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  const mobileNavItems = [
    { label: "首页", href: "/", icon: "🏠" },
    { label: "排盘", href: "/chart", icon: "☯" },
    { label: "会员", href: "/pricing", icon: "👑" },
    { label: "我的", href: isLoggedIn ? "/profile" : "/auth/login", icon: "👤" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/10 bg-white/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around py-2">
        {mobileNavItems.map((item) => {
          const isActive =
            item.href === "/profile"
              ? pathname === "/profile"
              : item.href === "/auth/login"
              ? pathname === "/auth/login"
              : pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>
                {item.label === "我的" && isLoggedIn
                  ? session.user.name?.slice(0, 3) || "我的"
                  : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
