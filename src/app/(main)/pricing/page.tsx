"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";

interface Plan {
  id: string;
  plan: string;
  name: string;
  price: string;
  period: string;
  originalPrice?: string;
  features: string[];
  cta: string;
  popular: boolean;
}

const plans: Plan[] = [
  {
    id: "free",
    plan: "FREE",
    name: "体验版",
    price: "免费",
    period: "",
    features: [
      "每日 3 次免费排盘",
      "AI 性格分析与运势解读",
      "查看分析内容的 1/3 预览",
      "基础命盘展示",
    ],
    cta: "免费使用",
    popular: false,
  },
  {
    id: "monthly",
    plan: "MONTHLY",
    name: "月度会员",
    price: "¥10",
    period: "/月",
    features: [
      "不限排盘次数",
      "完整 AI 分析内容",
      "全部 7 大分析模块",
      "历史记录查看",
      "优先客服支持",
    ],
    cta: "开通月度会员",
    popular: false,
  },
  {
    id: "quarterly",
    plan: "QUARTERLY",
    name: "季度会员",
    price: "¥25",
    period: "/季",
    originalPrice: "¥30",
    features: [
      "包含月度会员全部权益",
      "季度运势深度报告",
      "专属会员标识",
      "多模型 AI 自由切换",
    ],
    cta: "开通季度会员",
    popular: true,
  },
  {
    id: "yearly",
    plan: "YEARLY",
    name: "年度会员",
    price: "¥99",
    period: "/年",
    originalPrice: "¥120",
    features: [
      "包含季度会员全部权益",
      "年度运势深度报告",
      "VIP 专属功能",
      "优先体验新功能",
    ],
    cta: "开通年度会员",
    popular: false,
  },
];

const PLAN_LABELS: Record<string, string> = {
  FREE: "普通用户",
  MONTHLY: "月度会员",
  QUARTERLY: "季度会员",
  YEARLY: "年度会员",
};

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [membershipInfo, setMembershipInfo] = useState<{
    plan: string;
    endDate: string | null;
  } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const currentPlan = (session?.user?.membershipPlan as string) || "FREE";

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/profile")
        .then((r) => r.json())
        .then((data) => {
          if (data.membership) {
            setMembershipInfo({
              plan: data.membership.plan,
              endDate: data.membership.endDate,
            });
          }
        })
        .catch(() => {});
    }
  }, [status]);

  const handlePurchase = async (planId: string) => {
    if (planId === "free") {
      router.push("/chart");
      return;
    }

    if (status !== "authenticated") {
      toast.info("请先登录后再开通会员");
      router.push("/auth/login");
      return;
    }

    setPurchasing(planId);
    try {
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MEMBERSHIP",
          plan: planId.toUpperCase(),
          channel: "WECHAT",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`订单已创建（${data.amount}元），支付功能接入后将自动跳转`);
      } else {
        toast.error(data.error || "创建订单失败");
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setPurchasing(null);
    }
  };

  const isPlanActive = (plan: string) => {
    if (plan === "FREE") return true;
    if (currentPlan === plan && membershipInfo?.endDate) {
      return new Date(membershipInfo.endDate) > new Date();
    }
    return false;
  };

  const isCurrentPlan = (plan: string) => currentPlan === plan;

  return (
    <PageContainer maxWidth={1100}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <SectionTitle as="h1" icon="ti-crown" title="会员服务" />
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
          选择适合你的方案，解锁完整的命理分析与心理洞察
        </p>
        {status === "authenticated" && currentPlan !== "FREE" && membershipInfo?.endDate && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              padding: "6px 16px",
              borderRadius: 100,
              background: "var(--soft)",
              border: "1px solid var(--line)",
              fontSize: 13,
              color: "var(--ink-light)",
            }}
          >
            <span className="chip" style={{ background: "var(--brand)", color: "#fff", border: "none" }}>
              {PLAN_LABELS[currentPlan]}
            </span>
            <span>
              到期时间：{new Date(membershipInfo.endDate).toLocaleDateString("zh-CN")}
            </span>
          </div>
        )}
      </div>

      <div className="template-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {plans.map((plan) => {
          const isCurrent = isCurrentPlan(plan.plan);
          const isActive = isPlanActive(plan.plan);
          const showCurrentBadge = isCurrent && isActive && plan.plan !== "FREE";
          const cardStyle: CSSProperties = {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            textAlign: "center",
            paddingTop: showCurrentBadge || (plan.popular && !isCurrent) ? 28 : 20,
            transform: plan.popular && !isCurrent ? "scale(1.03)" : undefined,
          };

          return (
            <div
              key={plan.id}
              className={`plan-card${plan.popular ? " selected" : ""}${showCurrentBadge ? " selected" : ""}`}
              style={cardStyle}
            >
              {plan.popular && !isCurrent && (
                <span className="tag-best" style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}>
                  推荐
                </span>
              )}
              {showCurrentBadge && (
                <span
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--warning)",
                    color: "#fff",
                    padding: "3px 12px",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 600,
                    boxShadow: "var(--shadow)",
                  }}
                >
                  当前方案
                </span>
              )}

              <h3>{plan.name}</h3>
              <div className="price">
                {plan.originalPrice && (
                  <small style={{ textDecoration: "line-through", marginRight: 6, opacity: 0.6 }}>
                    {plan.originalPrice}
                  </small>
                )}
                {plan.price}
                <small> {plan.period}</small>
              </div>

              <ul>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <i className="ti ti-check" style={{ color: "var(--success)", marginTop: 4 }} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`btn ${plan.id === "free" ? "btn-ghost" : "btn-primary"}`}
                disabled={
                  (isCurrent && isActive && plan.plan !== "FREE") ||
                  purchasing === plan.id
                }
                onClick={() => handlePurchase(plan.id)}
                style={{ width: "100%", opacity: (isCurrent && isActive && plan.plan !== "FREE") || purchasing === plan.id ? 0.6 : 1 }}
              >
                {purchasing === plan.id
                  ? "处理中..."
                  : isCurrent && isActive && plan.plan !== "FREE"
                  ? "当前方案"
                  : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 32, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
        <p>
          也可以按次付费：
          <strong style={{ color: "var(--brand)" }}>¥0.5/次</strong>
          ，无需开通会员即可解锁单次完整分析
        </p>
        {process.env.NODE_ENV === "development" && (
          <p style={{ marginTop: 10, fontSize: 12 }}>
            <Link
              href="/pricing/mock-pay"
              style={{ color: "var(--brand)", textDecoration: "underline", textUnderlineOffset: 4 }}
            >
              开发：模拟支付（无真实扣款）
            </Link>
          </p>
        )}
      </div>
    </PageContainer>
  );
}
