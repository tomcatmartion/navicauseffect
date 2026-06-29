"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

type PendingOrder = {
  id: string;
  type: string;
  amount: number;
  channel: string;
  metadata: unknown;
  createdAt: string;
};

const PLAN_OPTIONS = [
  { plan: "MONTHLY", label: "月度会员", price: "¥29" },
  { plan: "QUARTERLY", label: "季度会员", price: "¥79" },
  { plan: "YEARLY", label: "年度会员", price: "¥268" },
];

const codeStyle: CSSProperties = {
  background: "var(--soft)",
  border: "1px solid var(--line-light)",
  borderRadius: 4,
  padding: "1px 6px",
  fontSize: 12,
  fontFamily: "var(--font-mono, monospace)",
};

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
    // B-07-2 + O-08：生产环境直接 redirect，不渲染任何 mock 入口
    if (process.env.NODE_ENV === "production") {
      router.replace("/pricing");
      return;
    }
    if (status === "unauthenticated") {
      setEnabled(null);
      setLoadingList(false);
      return;
    }
    if (status === "authenticated") {
      loadOrders();
    }
  }, [status, loadOrders, router]);

  // 生产环境早返（避免水合闪烁任何 mock UI）
  if (process.env.NODE_ENV === "production") {
    return null;
  }

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
      <PageContainer maxWidth={900}>
        <EmptyState icon="ti-loader-2" title="加载中…" />
      </PageContainer>
    );
  }

  if (status === "unauthenticated") {
    return (
      <PageContainer maxWidth={900}>
        <EmptyState icon="ti-lock" title="请先登录" description="登录后即可使用模拟支付">
          <Link href="/auth/login" className="btn btn-primary">去登录</Link>
        </EmptyState>
      </PageContainer>
    );
  }

  if (enabled === false) {
    return (
      <PageContainer maxWidth={900}>
        <div className="card">
          <SectionTitle icon="ti-shield-lock" title="模拟支付未启用" />
          <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8, marginTop: 12 }}>
            当前环境未开放模拟支付。本地开发默认可用；生产环境需在{" "}
            <code style={codeStyle}>.env</code> 中设置{" "}
            <code style={codeStyle}>ENABLE_MOCK_PAYMENT=true</code>{" "}
            并重启服务（请勿在公网正式环境长期开启）。
          </p>
          <div style={{ marginTop: 16 }}>
            <Link href="/pricing" className="btn btn-ghost btn-sm">
              <i className="ti ti-arrow-left" /> 返回定价页
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth={900}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <SectionTitle as="h1" icon="ti-devices" title="模拟支付" />
          <span className="chip" style={{ background: "var(--warning)", color: "#fff", border: "none" }}>
            <i className="ti ti-alert-triangle" /> 开发 / 测试
          </span>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.8 }}>
          创建真实 <code style={codeStyle}>PaymentOrder</code> 记录，再一键标记为已支付并执行与正式回调相同的履约逻辑（开通会员、单次加次）。不产生真实扣款。
        </p>
        <p style={{ color: "var(--warning)", fontSize: 12, marginTop: 6 }}>
          <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
          请勿在生产环境对最终用户开放此入口；生产如需测试请配合 IP 白名单或短期环境变量开关。
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <SectionTitle icon="ti-plus" title="快速创建待支付订单" />
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
          与定价页调用同一创建订单接口
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {PLAN_OPTIONS.map(({ plan, label, price }) => (
            <button
              key={plan}
              className="btn btn-ghost btn-sm"
              disabled={creating !== null}
              onClick={() => createOrder("MEMBERSHIP", plan)}
            >
              {creating === `MEMBERSHIP${plan}` ? (
                <><i className="ti ti-loader-2" /> 创建中…</>
              ) : (
                <><i className="ti ti-crown" /> {label} {price}</>
              )}
            </button>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            disabled={creating !== null}
            onClick={() => createOrder("PER_QUERY")}
          >
            {creating === "PER_QUERY" ? (
              <><i className="ti ti-loader-2" /> 创建中…</>
            ) : (
              <><i className="ti ti-coin" /> 单次解析加 1 次（¥0.5）</>
            )}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <SectionTitle icon="ti-list" title="待支付订单" />
          <button
            className="iconbtn"
            onClick={() => loadOrders()}
            disabled={loadingList}
            title="刷新"
          >
            <i className="ti ti-refresh" />
          </button>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4, marginBottom: 14 }}>
          点击「模拟支付成功」将调用履约逻辑，与 <code style={codeStyle}>/api/payment/callback</code> 效果一致（无签名校验）
        </p>

        {loadingList && enabled === null ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>加载中…</p>
        ) : orders.length === 0 ? (
          <EmptyState icon="ti-receipt" title="暂无待支付订单" description="可先在上方创建一个订单" />
        ) : (
          <div className="log-list">
            {orders.map((o) => (
              <div
                key={o.id}
                className="log-item"
                style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
              >
                <div className="log-info" style={{ width: "100%" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span className="chip">{o.type}</span>
                    <span className="log-amount" style={{ color: "var(--brand)" }}>¥{o.amount}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{o.channel}</span>
                  </div>
                  <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all", margin: 0 }}>
                    {o.id}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                    {new Date(o.createdAt).toLocaleString("zh-CN")}
                  </p>
                  {o.metadata != null &&
                    typeof o.metadata === "object" &&
                    Object.keys(o.metadata as object).length > 0 && (
                    <pre
                      style={{
                        maxHeight: 80,
                        overflow: "auto",
                        background: "var(--soft)",
                        border: "1px solid var(--line-light)",
                        borderRadius: 4,
                        padding: 8,
                        fontSize: 10,
                        margin: "6px 0 0",
                      }}
                    >
                      {JSON.stringify(o.metadata)}
                    </pre>
                  )}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => mockPay(o.id)}
                  disabled={payingId !== null}
                >
                  {payingId === o.id ? (
                    <><i className="ti ti-loader-2" /> 处理中…</>
                  ) : (
                    <><i className="ti ti-check" /> 模拟支付成功</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 16, fontSize: 13 }}>
        <Link href="/pricing" style={{ color: "var(--brand)", textDecoration: "underline", textUnderlineOffset: 4 }}>
          ← 返回会员定价
        </Link>
        <Link href="/chart" style={{ color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 4 }}>
          去排盘
        </Link>
      </div>
    </PageContainer>
  );
}
