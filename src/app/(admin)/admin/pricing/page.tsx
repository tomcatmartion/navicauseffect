"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">价格管理</h2>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">按次付费价格</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label>单次价格（元）</Label>
            <Input
              type="number"
              step="0.1"
              value={perQueryPrice}
              onChange={(e) => setPerQueryPrice(e.target.value)}
              className="w-32"
            />
            <Button onClick={savePerQueryPrice} disabled={saving === "perQuery"}>
              {saving === "perQuery" ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pricing.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          暂无价格配置数据（数据库中需初始化 membership_pricing 表）
        </div>
      )}

      <div className="grid gap-4">
        {pricing.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-6">
                <div>
                  <h3 className="font-semibold">{PLAN_LABELS[plan.plan] || plan.plan}</h3>
                  <p className="text-sm text-muted-foreground">{plan.plan}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <Label className="text-xs">原价（元）</Label>
                    <Input
                      type="number"
                      value={plan.originalPrice}
                      onChange={(e) => updateLocal(plan.id, "originalPrice", e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">活动价（元）</Label>
                    <Input
                      type="number"
                      value={plan.activityPrice ?? ""}
                      onChange={(e) => updateLocal(plan.id, "activityPrice", e.target.value)}
                      placeholder="留空=无活动"
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={plan.isActive}
                  onCheckedChange={(checked) => updateLocal(plan.id, "isActive", checked)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => savePlan(plan)}
                  disabled={saving === plan.id}
                >
                  {saving === plan.id ? "保存中..." : "保存"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
