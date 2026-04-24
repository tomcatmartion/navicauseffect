"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const plans = [
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

  const currentPlan = session?.user?.membershipPlan || "FREE";

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
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-3 font-[var(--font-serif-sc)] text-3xl font-bold text-primary md:text-4xl">
          会员服务
        </h1>
        <p className="text-muted-foreground">
          选择适合你的方案，解锁完整的命理分析与心理洞察
        </p>
        {status === "authenticated" && currentPlan !== "FREE" && membershipInfo?.endDate && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm">
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
              {PLAN_LABELS[currentPlan]}
            </Badge>
            <span className="text-amber-700">
              到期时间：{new Date(membershipInfo.endDate).toLocaleDateString("zh-CN")}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = isCurrentPlan(plan.plan);
          const isActive = isPlanActive(plan.plan);

          return (
            <Card
              key={plan.id}
              className={cn(
                "relative flex flex-col border transition-all hover:shadow-lg",
                plan.popular
                  ? "border-primary shadow-lg shadow-primary/10"
                  : isCurrent && isActive
                  ? "border-amber-400 shadow-md"
                  : "border-primary/10"
              )}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-3">推荐</Badge>
                </div>
              )}
              {isCurrent && isActive && plan.plan !== "FREE" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-amber-500 px-3">当前方案</Badge>
                </div>
              )}
              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                  {plan.originalPrice && (
                    <span className="mr-2 text-sm text-muted-foreground line-through">
                      {plan.originalPrice}
                    </span>
                  )}
                  <span className="text-3xl font-bold text-primary">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.period}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-primary">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={cn(
                    "w-full",
                    isCurrent && isActive && plan.plan !== "FREE"
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : plan.popular
                      ? "bg-primary hover:bg-primary/90"
                      : plan.id === "free"
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "bg-primary/80 hover:bg-primary/70"
                  )}
                  disabled={
                    (isCurrent && isActive && plan.plan !== "FREE") ||
                    purchasing === plan.id
                  }
                  onClick={() => handlePurchase(plan.id)}
                >
                  {purchasing === plan.id
                    ? "处理中..."
                    : isCurrent && isActive && plan.plan !== "FREE"
                    ? "当前方案"
                    : plan.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          也可以按次付费：<strong className="text-primary">¥0.5/次</strong>，无需开通会员即可解锁单次完整分析
        </p>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-3 text-xs text-muted-foreground">
            <Link
              href="/pricing/mock-pay"
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              开发：模拟支付（无真实扣款）
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
