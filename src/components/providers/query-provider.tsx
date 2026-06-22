"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query 全局 Provider。
 *
 * - staleTime 30s：大多数业务数据（命盘/报告/命主）短时间不会变化
 * - retry 1：网络抖动重试一次，再多交给用户手动重试
 * - refetchOnWindowFocus false：避免切窗反复刷新（紫微场景用户切窗频繁）
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
