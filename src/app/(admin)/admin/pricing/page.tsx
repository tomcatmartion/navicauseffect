"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface PricingItem {
  id: string;
  plan: string;
  originalPrice: number;
  activityPrice: number | null;
  isActive: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  MONTHLY: "包月",
  QUARTERLY: "包季",
  YEARLY: "包年",
};

export default function AdminPricingPage() {
  const [perQueryPrice, setPerQueryPrice] = useState("0.5");
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedId, setSavedId] = useState<string | null>(null);

  const flashSaved = (id: string) => {
    setSavedId(id);
    setTimeout(() => setSavedId((prev) => (prev === id ? null : prev)), 2000);
  };

  const fetchPricing = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pricing");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setPricing(
        data.pricing.map((p: PricingItem) => ({
          ...p,
          originalPrice: Number(p.originalPrice),
          activityPrice: p.activityPrice ? Number(p.activityPrice) : null,
        }))
      );
      setPerQueryPrice(String(data.perQueryPrice));
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const savePerQueryPrice = async () => {
    setSaving("perQuery");
    try {
      await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePerQueryPrice",
          price: parseFloat(perQueryPrice),
        }),
      });
      flashSaved("perQuery");
    } catch {
      setError("保存失败");
    } finally {
      setSaving(null);
    }
  };

  const savePlan = async (item: PricingItem) => {
    setSaving(item.id);
    try {
      await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePlan",
          id: item.id,
          originalPrice: item.originalPrice,
          activityPrice: item.activityPrice,
          isActive: item.isActive,
        }),
      });
      await fetchPricing();
      flashSaved(item.id);
    } catch {
      setError("保存失败");
    } finally {
      setSaving(null);
    }
  };

  const updateLocal = (id: string, field: string, value: string | boolean | number) => {
    setPricing((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === "isActive") return { ...p, isActive: value as boolean };
        if (field === "activityPrice") {
          const num = parseFloat(value as string);
          return { ...p, activityPrice: isNaN(num) ? null : num };
        }
        return { ...p, [field]: parseFloat(value as string) || 0 };
      })
    );
  };

  const getPeriod = (plan: string) =>
    plan === "MONTHLY" ? "月" : plan === "QUARTERLY" ? "季" : plan === "YEARLY" ? "年" : "期";

  return (
    <div className="space-y-6">
      {/* 页面标题区 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <i className="ti ti-cash text-xl" style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold">价格管理</h2>
          <p className="text-xs text-muted-foreground mt-0.5">配置按次付费单价与会员订阅套餐</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* 按次付费 —— 紧凑横排卡片 */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5"
        style={{ borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-lg"
            style={{ background: "var(--soft)" }}
          >
            <i className="ti ti-coin text-xl" style={{ color: "var(--brand)" }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--brand)" }}>
              按次付费
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              未开通会员时的单次扣费价格
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              ¥
            </span>
            <Input
              type="number"
              step="0.1"
              value={perQueryPrice}
              onChange={(e) => setPerQueryPrice(e.target.value)}
              className="w-28 pl-7 text-right font-semibold"
            />
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              /次
            </span>
          </div>
          <Button onClick={savePerQueryPrice} disabled={saving === "perQuery"}>
            <i className="ti ti-device-floppy" style={{ marginRight: 4 }} />
            {saving === "perQuery" ? "保存中..." : "保存"}
          </Button>
          {savedId === "perQuery" && (
            <span className="text-sm font-medium" style={{ color: "var(--success, #16a34a)" }}>
              <i className="ti ti-check" style={{ marginRight: 2 }} />
              已保存
            </span>
          )}
        </div>
      </div>

      {/* 会员套餐 —— 分区标题 */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--soft)" }}>
          <i className="ti ti-crown" style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--brand)" }}>
            会员套餐
          </h3>
          <p className="text-xs text-muted-foreground">月度 / 季度 / 年度订阅，可设置活动价</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border p-5"
              style={{ borderColor: "var(--line)", boxShadow: "var(--shadow)" }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg animate-pulse"
                  style={{ background: "var(--soft)" }}
                />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--soft)" }} />
                  <div className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--soft)" }} />
                </div>
              </div>
              <div
                className="mb-4 h-8 w-32 rounded animate-pulse pb-4"
                style={{ background: "var(--soft)" }}
              />
              <div className="space-y-3">
                <div className="h-9 rounded animate-pulse" style={{ background: "var(--soft)" }} />
                <div className="h-9 rounded animate-pulse" style={{ background: "var(--soft)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : pricing.length === 0 ? (
        <div
          className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground"
          style={{ borderColor: "var(--line)" }}
        >
          <i className="ti ti-database-off text-3xl block mb-2" style={{ color: "var(--line)" }} />
          暂无套餐数据（需在 membership_pricing 表初始化）
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {pricing.map((plan) => {
            const period = getPeriod(plan.plan);
            const hasDiscount =
              plan.activityPrice != null && plan.activityPrice > 0 && plan.originalPrice > 0;
            const displayPrice = hasDiscount ? plan.activityPrice! : plan.originalPrice;
            const discountPct = hasDiscount
              ? Math.round((1 - plan.activityPrice! / plan.originalPrice) * 100)
              : 0;

            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-xl border bg-card p-5 transition-all"
                style={{
                  borderColor: plan.isActive ? "var(--brand)" : "var(--line)",
                  boxShadow: plan.isActive ? "var(--shadow-lg)" : "var(--shadow)",
                  opacity: plan.isActive ? 1 : 0.72,
                }}
              >
                {/* 启用态顶部标签 */}
                {plan.isActive && (
                  <div
                    className="absolute -top-2 left-4 px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ background: "var(--brand)", borderRadius: "var(--radius-sm)" }}
                  >
                    已上线
                  </div>
                )}

                {/* 套餐头部：图标 + 名称 + 开关 */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: "var(--soft)" }}
                    >
                      <i className="ti ti-crown text-xl" style={{ color: "var(--brand)" }} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold" style={{ color: "var(--brand)" }}>
                        {PLAN_LABELS[plan.plan] || plan.plan}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">每{period}订阅</p>
                    </div>
                  </div>
                  <Switch
                    checked={plan.isActive}
                    onCheckedChange={(checked) => updateLocal(plan.id, "isActive", checked)}
                  />
                </div>

                {/* 大字号当前价格展示 */}
                <div
                  className="mb-4 flex items-baseline gap-2 pb-4"
                  style={{ borderBottom: `1px solid var(--line)` }}
                >
                  <span className="text-3xl font-bold leading-none" style={{ color: "var(--brand)" }}>
                    ¥{displayPrice}
                  </span>
                  <span className="text-sm text-muted-foreground">/{period}</span>
                  {hasDiscount && (
                    <span
                      className="ml-auto rounded px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "var(--soft)", color: "var(--danger)" }}
                    >
                      省{discountPct}%
                    </span>
                  )}
                </div>

                {/* 可编辑价格字段 */}
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">原价（元）</Label>
                    <div className="relative mt-1">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ¥
                      </span>
                      <Input
                        type="number"
                        value={plan.originalPrice}
                        onChange={(e) => updateLocal(plan.id, "originalPrice", e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">活动价（元）</Label>
                    <div className="relative mt-1">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ¥
                      </span>
                      <Input
                        type="number"
                        value={plan.activityPrice ?? ""}
                        onChange={(e) => updateLocal(plan.id, "activityPrice", e.target.value)}
                        placeholder="留空 = 无活动"
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>

                {/* 底部操作区 */}
                <div
                  className="mt-4 flex items-center justify-between pt-4"
                  style={{ borderTop: `1px solid var(--line)` }}
                >
                  <span className="text-[11px] text-muted-foreground">
                    {savedId === plan.id ? (
                      <span style={{ color: "var(--success, #16a34a)" }}>
                        <i className="ti ti-check" style={{ marginRight: 2 }} />
                        已保存
                      </span>
                    ) : hasDiscount ? (
                      `原价 ¥${plan.originalPrice}`
                    ) : (
                      "无活动价"
                    )}
                  </span>
                  <Button onClick={() => savePlan(plan)} disabled={saving === plan.id}>
                    <i className="ti ti-device-floppy" style={{ marginRight: 4 }} />
                    {saving === plan.id ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
