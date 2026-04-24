"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type PendingOrder = {
  id: string;
  type: string;
  amount: number;
  channel: string;
  metadata: unknown;
  createdAt: string;
};

const PLAN_OPTIONS = [
  { plan: "MONTHLY", label: "月度会员", price: "¥10" },
  { plan: "QUARTERLY", label: "季度会员", price: "¥25" },
  { plan: "YEARLY", label: "年度会员", price: "¥99" },
];

export default function MockPayPage() {
  const { status, update } = useSession();
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/payment/mock");
      if (res.status === 403) {
        setEnabled(false);
        setOrders([]);
        return;
      }
      setEnabled(true);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "加载失败");
      }
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载订单失败");
      setOrders([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      setEnabled(null);
      setLoadingList(false);
      return;
    }
    if (status === "authenticated") {
      loadOrders();
    }
  }, [status, loadOrders]);

  const createOrder = async (
    type: "MEMBERSHIP" | "PER_QUERY",
    plan?: string
  ) => {
    const key = type + (plan ?? "");
    setCreating(key);
    try {
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          plan: plan ?? undefined,
          channel: "WECHAT",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建订单失败");
        return;
      }
      toast.success(`已创建订单 ${data.orderId?.slice(0, 8)}…`);
      await loadOrders();
    } catch {
      toast.error("网络错误");
    } finally {
      setCreating(null);
    }
  };

  const mockPay = async (orderId: string) => {
    setPayingId(orderId);
    try {
      const res = await fetch("/api/payment/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "模拟支付失败");
        return;
      }
      if (data.alreadyPaid) {
        toast.info("该订单已是已支付状态");
      } else {
        toast.success("模拟支付成功，会员/次数已入账");
      }
      await update?.();
      await loadOrders();
      router.refresh();
    } catch {
      toast.error("网络错误");
    } finally {
      setPayingId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        加载中…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4 text-muted-foreground">请先登录后再使用模拟支付</p>
        <Button asChild>
          <Link href="/auth/login">去登录</Link>
        </Button>
      </div>
    );
  }

  if (enabled === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>模拟支付未启用</CardTitle>
            <CardDescription>
              当前环境未开放模拟支付。本地开发默认可用；生产环境需在{" "}
              <code className="rounded bg-muted px-1">.env</code> 中设置{" "}
              <code className="rounded bg-muted px-1">ENABLE_MOCK_PAYMENT=true</code>{" "}
              并重启服务（请勿在公网正式环境长期开启）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/pricing">返回定价页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 md:py-14">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="font-[var(--font-serif-sc)] text-2xl font-bold text-primary md:text-3xl">
            模拟支付
          </h1>
          <Badge variant="secondary">开发 / 测试</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          创建真实{" "}
          <code className="rounded bg-muted px-1 text-xs">PaymentOrder</code>{" "}
          记录，再一键标记为已支付并执行与正式回调相同的履约逻辑（开通会员、单次加次）。不产生真实扣款。
        </p>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
          请勿在生产环境对最终用户开放此入口；生产如需测试请配合 IP 白名单或短期环境变量开关。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">快速创建待支付订单</CardTitle>
          <CardDescription>与定价页调用同一创建订单接口</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {PLAN_OPTIONS.map(({ plan, label, price }) => (
            <Button
              key={plan}
              variant="outline"
              disabled={creating !== null}
              onClick={() => createOrder("MEMBERSHIP", plan)}
            >
              {creating === `MEMBERSHIP${plan}` ? "创建中…" : `${label} ${price}`}
            </Button>
          ))}
          <Button
            variant="secondary"
            disabled={creating !== null}
            onClick={() => createOrder("PER_QUERY")}
          >
            {creating === "PER_QUERY" ? "创建中…" : "单次解析加 1 次（¥0.5）"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">待支付订单</CardTitle>
            <CardDescription>
              点击「模拟支付成功」将调用履约逻辑，与{" "}
              <code className="text-xs">/api/payment/callback</code> 效果一致（无签名校验）
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadOrders()}
            disabled={loadingList}
          >
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {loadingList && enabled === null ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无待支付订单，可先上方创建。</p>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{o.type}</Badge>
                      <span className="font-medium">¥{o.amount}</span>
                      <span className="text-muted-foreground">{o.channel}</span>
                    </div>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {o.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString("zh-CN")}
                    </p>
                    {o.metadata != null &&
                      typeof o.metadata === "object" &&
                      Object.keys(o.metadata as object).length > 0 && (
                      <pre className="max-h-20 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                        {JSON.stringify(o.metadata)}
                      </pre>
                    )}
                  </div>
                  <Button
                    onClick={() => mockPay(o.id)}
                    disabled={payingId !== null}
                  >
                    {payingId === o.id ? "处理中…" : "模拟支付成功"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3 text-sm">
        <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
          ← 返回会员定价
        </Link>
        <Link href="/chart" className="text-muted-foreground underline-offset-4 hover:underline">
          去排盘
        </Link>
      </div>
    </div>
  );
}
