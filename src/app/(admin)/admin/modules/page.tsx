"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const CONFIG_KEY = "vip_analysis_categories";

const ANALYSIS_MODULES: { id: string; label: string }[] = [
  { id: "PERSONALITY", label: "性格分析" },
  { id: "FORTUNE", label: "总体运势" },
  { id: "MARRIAGE", label: "感情婚姻" },
  { id: "CAREER", label: "事业财运" },
  { id: "HEALTH", label: "身体健康" },
  { id: "PARENT_CHILD", label: "亲子关系" },
  { id: "EMOTION", label: "情绪疏导" },
];

export default function AdminModulesPage() {
  const [vipIds, setVipIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setError("");
      const res = await fetch(`/api/admin/config?key=${CONFIG_KEY}`);
      if (!res.ok) throw new Error("加载失败");
      const value = await res.json();
      if (Array.isArray(value) && value.length > 0) {
        setVipIds(new Set(value.filter((s: unknown) => typeof s === "string")));
      } else {
        setVipIds(new Set(["MARRIAGE", "CAREER", "HEALTH", "PARENT_CHILD", "EMOTION"]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const toggle = (id: string, checked: boolean) => {
    setVipIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: CONFIG_KEY,
          value: Array.from(vipIds),
        }),
      });
      if (!res.ok) throw new Error("保存失败");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">收费模块管理</h2>
        <p className="text-muted-foreground">加载中…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">收费模块管理</h2>
      <p className="text-sm text-muted-foreground">
        设置前端「AI 智能解析」下 7 个业务模块中哪些为「VIP 专项」。设为 VIP 专项的模块，未付费用户需升级 VIP 或单次付费后才能进行 AI 解读。
      </p>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">VIP 专项开关</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ANALYSIS_MODULES.map((mod) => (
            <div
              key={mod.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <Label className="flex-1">
                <span className="font-medium">{mod.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">({mod.id})</span>
              </Label>
              <Switch
                checked={vipIds.has(mod.id)}
                onCheckedChange={(checked) => toggle(mod.id, checked)}
              />
            </div>
          ))}
          <div className="pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
