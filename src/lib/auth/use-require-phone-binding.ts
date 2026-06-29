"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";

/**
 * B-17：客户端 phoneBindingRequired 检查 hook
 *
 * 用途：所有「付费 / 关键操作」入口在执行前调用此 hook 返回的 guard 函数，
 *      若用户是微信登录但未绑定手机号，自动 toast + 跳 /auth/bind-phone。
 *
 * 后端等价物：middleware 加 phone 检查（本次范围外，需后端改造）。
 *
 * 使用示例：
 *   const requirePhoneBinding = useRequirePhoneBinding();
 *   const handlePurchase = () => {
 *     if (requirePhoneBinding()) return;
 *     // ...继续付费逻辑
 *   };
 *
 * @returns guard 函数，返回 true 表示已拦截（应中断当前操作），false 表示放行
 */
export function useRequirePhoneBinding() {
  const { data: session } = useSession();
  const router = useRouter();

  return useCallback((): boolean => {
    const user = session?.user as { phoneBindingRequired?: boolean } | undefined;
    if (user?.phoneBindingRequired) {
      toast.info("微信登录用户需先绑定手机号，才能使用此功能", { duration: 4000 });
      const callbackUrl = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
      router.push(`/auth/bind-phone?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return true;
    }
    return false;
  }, [session, router]);
}
