"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { ErrorRetryCard } from "@/components/shared/error-retry-card";
import { LoadingState } from "@/components/shared/loading-state";

// ──────────────────────────────────────────────────────────────
// 类型定义
// ──────────────────────────────────────────────────────────────

type MembershipPricing = {
  plan: "MONTHLY" | "QUARTERLY" | "YEARLY";
  originalPrice: number;
  activityPrice: number | null;
};

type CreditPack = {
  id: string;
  count: number;
  price: number;
  label?: string;
  popular?: boolean;
};

type CoinPack = {
  id: string;
  amount: number;
  price: number;
  bonus: number;
  label?: string;
  popular?: boolean;
};

type PricingConfig = {
  memberships: MembershipPricing[];
  creditPacks: CreditPack[];
  coinPacks: CoinPack[];
};

// ──────────────────────────────────────────────────────────────
// 静态展示数据（无法从 AdminConfig 配置的部分）
// ──────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  FREE: "免费体验",
  MONTHLY: "月度会员",
  QUARTERLY: "季度会员",
  YEARLY: "年度会员",
};

/** 套餐展示补充信息（折扣 / 每日赠送 / 专属报告） */
type PlanFeature = {
  reportDiscount: string;
  dailyCoins: number;
  exclusive: string;
};

const PLAN_FEATURES: Record<"MONTHLY" | "QUARTERLY" | "YEARLY", PlanFeature> = {
  MONTHLY: { reportDiscount: "9 折", dailyCoins: 5, exclusive: "专属报告：每月运势" },
  QUARTERLY: { reportDiscount: "8 折", dailyCoins: 6, exclusive: "专属报告：季度运势 + 亲子" },
  YEARLY: { reportDiscount: "7 折", dailyCoins: 8, exclusive: "专属报告：全维度 + 流年推演" },
};

/** 权益对比表 */
const COMPARE_ROWS: Array<{
  feature: string;
  values: [string, string, string, string]; // 免费 / 月 / 季 / 年
  highlight?: number; // 第几列高亮（0-based）
}> = [
  { feature: "命盘生成", values: ["✓ 无限", "✓ 无限", "✓ 无限", "✓ 无限"] },
  { feature: "AI 对话", values: ["每日 3 次", "✓ 无限", "✓ 无限", "✓ 无限"] },
  { feature: "报告折扣", values: ["—", "9 折", "8 折", "7 折"], highlight: 3 },
  { feature: "合盘折扣", values: ["—", "9 折", "8 折", "7 折"] },
  { feature: "每日赠送星币", values: ["—", "5", "6", "8"] },
  { feature: "专属报告", values: ["—", "月运", "季度 + 亲子", "全维度 + 流年"] },
  {
    feature: "历史报告保存",
    values: ["30 天", "1 年", "3 年", "永久"],
    highlight: 3,
  },
  { feature: "客服", values: ["普通", "普通", "优先", "专属 1v1"] },
];

// ──────────────────────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipInfo, setMembershipInfo] = useState<{
    plan: string;
    endDate: string | null;
  } | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [payChannel, setPayChannel] = useState<"WECHAT" | "ALIPAY">("WECHAT");
  // O-09：下单失败时展示结构化错误卡片（记录重试所需参数）
  const [purchaseError, setPurchaseError] = useState<{
    title: string;
    detail: string;
    code?: string | number;
    retryType?: "MEMBERSHIP" | "CREDIT_PACK" | "COIN_PACK";
    retryPayload?: { plan?: string; packId?: string };
    retryLabel?: string;
  } | null>(null);

  const currentPlan = (session?.user?.membershipPlan as string) || "FREE";

  // 拉取价格配置 + 当前会员信息
  useEffect(() => {
    Promise.all([
      fetch("/api/pricing").then((r) => r.json()),
      status === "authenticated"
        ? fetch("/api/user/profile").then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([cfg, profile]) => {
        setConfig(cfg);
        if (profile?.membership) {
          setMembershipInfo({
            plan: profile.membership.plan,
            endDate: profile.membership.endDate,
          });
        }
      })
      .catch(() => toast.error("加载价格失败"))
      .finally(() => setLoading(false));
  }, [status]);

  // 统一下单
  const handlePurchase = async (
    type: "MEMBERSHIP" | "CREDIT_PACK" | "COIN_PACK",
    payload: { plan?: string; packId?: string },
    label: string,
  ) => {
    if (status !== "authenticated") {
      toast.info("请先登录后再购买");
      router.push("/auth/login");
      return;
    }
    // B-17：微信登录未绑定手机的用户，付费前强制引导绑定
    if ((session?.user as { phoneBindingRequired?: boolean }).phoneBindingRequired) {
      toast.info("微信登录用户需先绑定手机号，才能完成购买");
      router.push(`/auth/bind-phone?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    const key = `${type}:${payload.plan ?? payload.packId ?? ""}`;
    setPurchasing(key);
    setPurchaseError(null);
    try {
      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, channel: payChannel, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.mock) {
          toast.success(`${label} 订单已创建（演示模式）`, {
            action: {
              label: "去模拟支付",
              onClick: () => router.push("/pricing/mock-pay"),
            },
          });
        } else {
          toast.success(`${label} 订单已创建（¥${data.amount}）`);
        }
      } else {
        setPurchaseError({
          title: "创建订单失败",
          detail: data.error || "支付服务暂时不可用，请稍后重试",
          code: res.status,
          retryType: type,
          retryPayload: payload,
          retryLabel: label,
        });
      }
    } catch {
      setPurchaseError({
        title: "网络错误",
        detail: "无法连接到支付服务，请检查网络后重试",
        code: "NETWORK_ERROR",
        retryType: type,
        retryPayload: payload,
        retryLabel: label,
      });
    } finally {
      setPurchasing(null);
    }
  };

  const isPlanActive = (plan: string): boolean => {
    if (plan === "FREE") return true;
    if (currentPlan === plan && membershipInfo?.endDate) {
      return new Date(membershipInfo.endDate) > new Date();
    }
    return false;
  };

  const isCurrentPlan = (plan: string) => currentPlan === plan && plan !== "FREE";

  // ── 渲染 ──────────────────────────────────────────────

  if (loading) {
    return (
      <PageContainer maxWidth={1100}>
        <LoadingState title="加载会员方案中…" description="请稍候" />
      </PageContainer>
    );
  }

  // 4 档套餐（含免费）
  const allPlans: Array<{
    plan: string;
    name: string;
    price: number;
    period: string;
    popular?: boolean;
    features: string[];
    cta: string;
  }> = [
    {
      plan: "FREE",
      name: "免费体验",
      price: 0,
      period: "/永久",
      features: [
        "每日 3 次 AI 对话",
        "基础命盘生成",
        "查看分析预览（1/3）",
        "报告原价购买",
      ],
      cta: "免费使用",
    },
  ];

  for (const planDef of ["MONTHLY", "QUARTERLY", "YEARLY"] as const) {
    const pricing = config?.memberships.find((m) => m.plan === planDef);
    const price = pricing?.activityPrice ?? pricing?.originalPrice ?? 0;
    const feat = PLAN_FEATURES[planDef];
    const days = planDef === "MONTHLY" ? "/月" : planDef === "QUARTERLY" ? "/3 个月" : "/年";
    allPlans.push({
      plan: planDef,
      name: PLAN_LABELS[planDef],
      price,
      period: days,
      popular: planDef === "YEARLY",
      features: [
        `报告 / 合盘 ${feat.reportDiscount}`,
        `每日赠送 ${feat.dailyCoins} 星币`,
        feat.exclusive,
        "无限次 AI 对话",
        ...(planDef === "YEARLY" ? ["历史报告永久保存", "专属客服 + 1v1 顾问"] : []),
      ],
      cta: planDef === "YEARLY" ? "开通年度" : `开通${planDef === "MONTHLY" ? "月度" : "季度"}`,
    });
  }

  return (
    <PageContainer maxWidth={1100}>
      {/* 顶部标题 + 当前会员状态 */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <SectionTitle as="h1" icon="ti-crown" title="会员与充值" />
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>
          升级会员 · 享更多权益 · 每日赠送星币 · 折扣购买报告
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
            <span
              className="chip"
              style={{ background: "var(--warning)", color: "#fff", border: "none" }}
            >
              <i className="ti ti-crown" /> {PLAN_LABELS[currentPlan]}
            </span>
            <span>
              {isPlanActive(currentPlan)
                ? `到期：${new Date(membershipInfo.endDate).toLocaleDateString("zh-CN")}`
                : "已过期"}
            </span>
          </div>
        )}
      </div>

      {/* O-09：下单失败重试卡片 */}
      {purchaseError && (
        <ErrorRetryCard
          title={purchaseError.title}
          detail={purchaseError.detail}
          code={purchaseError.code}
          retrying={purchasing !== null}
          onRetry={() => {
            if (purchaseError.retryType && purchaseError.retryPayload && purchaseError.retryLabel) {
              handlePurchase(purchaseError.retryType, purchaseError.retryPayload, purchaseError.retryLabel);
            }
          }}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* ─── 1. 会员套餐 ────────────────────────────────── */}
      <div className="page-header" style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, color: "var(--brand)", fontFamily: "var(--font-head)" }}>
          <i className="ti ti-crown" style={{ marginRight: 8 }} />
          升级会员 · 享更多权益
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
          会员期内，所有报告与合盘享折扣，每日额外赠送星币
        </p>
      </div>

      <div
        className="plan-cards"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {allPlans.map((plan) => {
          const isActive = isPlanActive(plan.plan);
          const isCurrent = isCurrentPlan(plan.plan);
          const showCurrentBadge = isCurrent && isActive;
          const isFree = plan.plan === "FREE";
          const cardStyle: CSSProperties = {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            textAlign: "center",
            paddingTop: showCurrentBadge || plan.popular ? 28 : 20,
          };

          return (
            <div
              key={plan.plan}
              className={`plan-card${plan.popular && !isCurrent ? " selected" : ""}${showCurrentBadge ? " selected" : ""}`}
              style={cardStyle}
            >
              {plan.popular && !isCurrent && (
                <span
                  className="tag-best"
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
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
                  当前方案 · 已开通
                </span>
              )}

              <h3>{plan.name}</h3>
              <div className="price">
                {isFree ? "¥0" : `¥${plan.price}`}
                <small> {plan.period}</small>
              </div>

              <ul>
                {plan.features.map((feat) => (
                  <li key={feat} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    <i
                      className="ti ti-check"
                      style={{ color: "var(--success)", marginTop: 4, fontSize: 12 }}
                    />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={`btn ${isFree ? "btn-ghost" : "btn-primary"}`}
                disabled={showCurrentBadge || purchasing === `MEMBERSHIP:${plan.plan}`}
                onClick={() => {
                  if (isFree) {
                    router.push("/chart");
                    return;
                  }
                  handlePurchase("MEMBERSHIP", { plan: plan.plan }, plan.name);
                }}
                style={{
                  width: "100%",
                  opacity: showCurrentBadge || purchasing === `MEMBERSHIP:${plan.plan}` ? 0.6 : 1,
                }}
              >
                {purchasing === `MEMBERSHIP:${plan.plan}`
                  ? "处理中…"
                  : showCurrentBadge
                    ? "当前方案"
                    : isCurrent && !isActive
                      ? "续费"
                      : plan.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p
        style={{
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 12,
          marginTop: 14,
        }}
      >
        <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
        月/季卡为自动续费，可随时取消 · 年卡为一次性付款
        {process.env.NODE_ENV === "development" && (
          <>
            {" · "}
            <Link
              href="/pricing/mock-pay"
              style={{ color: "var(--text-muted)", textDecoration: "underline" }}
            >
              开发：模拟支付
            </Link>
          </>
        )}
      </p>

      {/* ─── 2. 按次付费 ────────────────────────────────── */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle icon="ti-ticket" title="按次付费" />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, marginTop: 4 }}>
        不想开会员？也可以购买单次测算次数，永久有效
      </p>

      <div
        className="credit-packages"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        {(config?.creditPacks ?? []).map((pack) => {
          const key = `CREDIT_PACK:${pack.id}`;
          return (
            <button
              type="button"
              key={pack.id}
              className={`credit-card${pack.popular ? " selected" : ""}`}
              style={{
                cursor: "pointer",
                textAlign: "center",
                opacity: purchasing === key ? 0.6 : 1,
                border: "none",
                font: "inherit",
              }}
              disabled={purchasing === key}
              onClick={() =>
                handlePurchase("CREDIT_PACK", { packId: pack.id }, `${pack.count} 次套餐`)
              }
            >
              <div className="coin">
                <i className="ti ti-coin" /> × {pack.count}
              </div>
              <div className="price">
                ¥{pack.price}
                <small>.00</small>
              </div>
              <div className="bonus">{pack.label}</div>
            </button>
          );
        })}
      </div>

      {/* ─── 3. 星币充值 ────────────────────────────────── */}
      <div style={{ marginTop: 36 }}>
        <SectionTitle icon="ti-coin" title="星币充值（消耗品）" />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16, marginTop: 4 }}>
        星币可直接用于报告、合盘、AI 对话，无有效期
      </p>

      <div
        className="coin-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        {(config?.coinPacks ?? []).map((pack) => {
          const key = `COIN_PACK:${pack.id}`;
          return (
            <button
              type="button"
              key={pack.id}
              className={`coin-card${pack.popular ? " selected" : ""}`}
              style={{
                cursor: "pointer",
                textAlign: "center",
                opacity: purchasing === key ? 0.6 : 1,
                border: "none",
                font: "inherit",
              }}
              disabled={purchasing === key}
              onClick={() =>
                handlePurchase("COIN_PACK", { packId: pack.id }, `${pack.amount} 星币包`)
              }
            >
              <div className="coin-amount">{pack.amount} 星币</div>
              <div className="coin-price">¥{pack.price.toFixed(2)}</div>
              {pack.bonus > 0 && (
                <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4 }}>
                  赠 {pack.bonus} · {pack.label}
                </div>
              )}
              {pack.bonus === 0 && pack.label && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {pack.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 4. 支付方式 ────────────────────────────────── */}
      <div style={{ marginTop: 36, marginBottom: 12 }}>
        <SectionTitle icon="ti-credit-card" title="支付方式" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <label className="setting-row" style={{ margin: 0 }}>
          <span className="sr-l">
            <span
              className="sr-icon"
              style={{ background: "var(--brand-wechat-soft)", color: "var(--brand-wechat)" }}
            >
              <i className="ti ti-brand-wechat" />
            </span>
            <span>
              <span className="sr-title">微信支付</span>
              <div className="sr-desc">推荐 · 支持扫码 / APP</div>
            </span>
          </span>
          <input
            type="radio"
            name="pay"
            checked={payChannel === "WECHAT"}
            onChange={() => setPayChannel("WECHAT")}
          />
        </label>
        <label className="setting-row" style={{ margin: 0 }}>
          <span className="sr-l">
            <span
              className="sr-icon"
              style={{ background: "var(--brand-alipay-soft)", color: "var(--brand-alipay)" }}
            >
              <i className="ti ti-brand-alipay" />
            </span>
            <span>
              <span className="sr-title">支付宝</span>
              <div className="sr-desc">安全便捷</div>
            </span>
          </span>
          <input
            type="radio"
            name="pay"
            checked={payChannel === "ALIPAY"}
            onChange={() => setPayChannel("ALIPAY")}
          />
        </label>
      </div>

      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textAlign: "center",
          marginTop: 24,
        }}
      >
        <i className="ti ti-shield-lock" style={{ marginRight: 4 }} />
        支付即视为同意《用户协议》《付费服务协议》· 发票请联系客服
      </p>

      {/* ─── 5. 权益对比表 ────────────────────────────── */}
      <div style={{ marginTop: 40, marginBottom: 12 }}>
        <SectionTitle icon="ti-scale" title="会员权益对比" />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>权益</th>
              <th>免费用户</th>
              <th>月度</th>
              <th>季度</th>
              <th>年度</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.feature}>
                <td>{row.feature}</td>
                {row.values.map((val, idx) => (
                  <td
                    key={idx}
                    style={
                      row.highlight === idx
                        ? { color: "var(--brand)", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
