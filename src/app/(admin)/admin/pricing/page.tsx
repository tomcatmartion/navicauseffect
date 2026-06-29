"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

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

const PLAN_ORDER = ["MONTHLY", "QUARTERLY", "YEARLY"];

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
      const sorted = (data.pricing as PricingItem[])
        .map((p) => ({
          ...p,
          originalPrice: Number(p.originalPrice),
          activityPrice: p.activityPrice ? Number(p.activityPrice) : null,
        }))
        .sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));
      setPricing(sorted);
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
    <>
      <AdminPageHeader
        icon="ti-cash"
        title="价格管理"
        desc="配置按次付费单价与会员订阅套餐"
      />

      {error && (
        <div className="admin-alert error">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      )}

      {/* 按次付费 */}
      <AdminCard className="pricing-perquery">
        <div className="pricing-perquery-inner">
          <div className="pricing-perquery-info">
            <div className="admin-stat-icon">
              <i className="ti ti-coin" />
            </div>
            <div>
              <h3 className="admin-card-title">按次付费</h3>
              <p className="admin-card-desc">未开通会员时的单次 AI 解盘扣费价格</p>
            </div>
          </div>
          <div className="pricing-perquery-action">
            <div className="pricing-input-wrap">
              <span className="pricing-currency">¥</span>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={perQueryPrice}
                onChange={(e) => setPerQueryPrice(e.target.value)}
                className="pricing-price-input"
              />
              <span className="pricing-unit">/ 次</span>
            </div>
            <Button onClick={savePerQueryPrice} disabled={saving === "perQuery"}>
              <i className="ti ti-device-floppy" />
              {saving === "perQuery" ? "保存中" : "保存"}
            </Button>
            {savedId === "perQuery" && (
              <span className="pricing-saved-hint">
                <i className="ti ti-check" />
                已保存
              </span>
            )}
          </div>
        </div>
      </AdminCard>

      {/* 会员套餐标题 */}
      <div className="pricing-section-head">
        <div className="pricing-section-title">
          <i className="ti ti-crown" />
          <span>会员套餐</span>
        </div>
        <span className="pricing-section-sub">月度 / 季度 / 年度订阅，支持设置活动价</span>
      </div>

      {loading ? (
        <div className="pricing-plan-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="admin-card pricing-plan-card skeleton">
              <div className="admin-card-body">
                <div className="pricing-skeleton-line" style={{ height: 40 }} />
                <div className="pricing-skeleton-line" style={{ height: 36 }} />
                <div className="pricing-skeleton-line" style={{ height: 40 }} />
                <div className="pricing-skeleton-line" style={{ height: 40 }} />
              </div>
            </div>
          ))}
        </div>
      ) : pricing.length === 0 ? (
        <AdminEmptyState
          icon="ti-database-off"
          title="暂无套餐数据"
          desc="需在 membership_pricing 表初始化月度/季度/年度套餐记录"
        />
      ) : (
        <div className="pricing-plan-grid">
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
                className={`admin-card pricing-plan-card${plan.isActive ? " active" : " disabled"}`}
              >
                <div className="admin-card-body">
                  {/* 头部 */}
                  <div className="pricing-plan-head">
                    <div className="pricing-plan-title">
                      <div className="admin-stat-icon">
                        <i className="ti ti-crown" />
                      </div>
                      <div>
                        <h4 className="admin-card-title">{PLAN_LABELS[plan.plan] || plan.plan}</h4>
                        <p className="admin-card-desc">每{period}订阅</p>
                      </div>
                    </div>
                    <div className="pricing-plan-status">
                      {plan.isActive ? (
                        <span className="admin-badge success">已上线</span>
                      ) : (
                        <span className="admin-badge neutral">未上线</span>
                      )}
                      <Switch
                        checked={plan.isActive}
                        onCheckedChange={(checked) => updateLocal(plan.id, "isActive", checked)}
                      />
                    </div>
                  </div>

                  {/* 价格 */}
                  <div className="pricing-plan-price">
                    <div className="pricing-current">
                      <span className="pricing-current-symbol">¥</span>
                      <span className="pricing-current-value">{displayPrice}</span>
                      <span className="pricing-current-period">/ {period}</span>
                    </div>
                    {hasDiscount && (
                      <span className="pricing-discount">省 {discountPct}%</span>
                    )}
                  </div>

                  {/* 表单 */}
                  <div className="pricing-plan-fields">
                    <div className="field">
                      <Label className="field-label">原价（元）</Label>
                      <div className="pricing-input-wrap">
                        <span className="pricing-currency">¥</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={plan.originalPrice}
                          onChange={(e) => updateLocal(plan.id, "originalPrice", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <Label className="field-label">活动价（元）</Label>
                      <div className="pricing-input-wrap">
                        <span className="pricing-currency">¥</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={plan.activityPrice ?? ""}
                          onChange={(e) => updateLocal(plan.id, "activityPrice", e.target.value)}
                          placeholder="留空 = 无活动"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 底部 */}
                  <div className="pricing-plan-foot">
                    <span className="pricing-foot-note">
                      {savedId === plan.id ? (
                        <span className="text-success">
                          <i className="ti ti-check" />
                          已保存
                        </span>
                      ) : hasDiscount ? (
                        `原价 ¥${plan.originalPrice}，活动价 ¥${plan.activityPrice}`
                      ) : (
                        "当前无活动价"
                      )}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => savePlan(plan)}
                      disabled={saving === plan.id}
                    >
                      <i className="ti ti-device-floppy" />
                      {saving === plan.id ? "保存中" : "保存"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
