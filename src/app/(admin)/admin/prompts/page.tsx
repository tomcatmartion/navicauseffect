"use client";

import { useCallback, useEffect, useState } from "react";
import { AnalysisCategory } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AnalysisPromptsPayload } from "@/lib/ai/prompts";

const CATEGORY_LABELS: Record<AnalysisCategory, string> = {
  PERSONALITY: "性格分析",
  FORTUNE: "总体运势",
  MARRIAGE: "感情婚姻",
  CAREER: "事业财运",
  HEALTH: "身体健康",
  PARENT_CHILD: "亲子关系",
  EMOTION: "情绪疏导",
};

const CATEGORIES = Object.values(AnalysisCategory);

type ApiGet = {
  defaults: AnalysisPromptsPayload;
  stored: unknown;
  effective: AnalysisPromptsPayload;
};

export default function AdminPromptsPage() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [categoryPrompts, setCategoryPrompts] = useState<
    Record<AnalysisCategory, string>
  >({} as Record<AnalysisCategory, string>);
  const [defaults, setDefaults] = useState<AnalysisPromptsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applyPayload = useCallback((p: AnalysisPromptsPayload) => {
    setSystemPrompt(p.systemPrompt);
    setCategoryPrompts({ ...p.categoryPrompts });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ai-prompts");
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as ApiGet;
      setDefaults(data.defaults);
      applyPayload(data.effective);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: AnalysisPromptsPayload = {
        systemPrompt,
        categoryPrompts,
      };
      const res = await fetch("/api/admin/ai-prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "保存失败");
      }
      setSuccess("已保存，前台下次解盘将使用新文案。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const resetToBuiltin = () => {
    if (defaults) applyPayload(defaults);
    setSuccess("");
    setError("");
  };

  const clearDbAndUseBuiltin = async () => {
    if (!confirm("确定清除数据库中的自定义配置？清除后将始终使用代码内置默认，直至再次保存。")) {
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/ai-prompts", { method: "DELETE" });
      if (!res.ok) throw new Error("清除失败");
      await fetchData();
      setSuccess("已清除库中配置，当前展示为内置默认。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "清除失败");
    } finally {
      setSaving(false);
    }
  };

  const setCategory = (cat: AnalysisCategory, value: string) => {
    setCategoryPrompts((prev) => ({ ...prev, [cat]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">大模型 Prompt 配置</h2>
        <p className="text-muted-foreground">加载中…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">大模型 Prompt 配置</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          此处配置会写入数据库（AdminConfig · <code className="text-xs">ai_prompts</code>
          ），解盘接口优先使用此处文案；未填写或清除后回退为代码内置默认。logicdoc
          知识库仍在运行时拼接进 system，不在此编辑。
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">全局 System 人设</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="system-prompt">system 前缀（logicdoc 会追加在其后）</Label>
          <Textarea
            id="system-prompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">各分析模块 · User 任务说明</h3>
        <p className="text-sm text-muted-foreground">
          以下为每条请求中 user 消息的「任务说明」部分；命盘 JSON 仍由系统自动拼接。
        </p>
        {CATEGORIES.map((cat) => (
          <Card key={cat}>
            <CardHeader className="py-3">
              <CardTitle className="text-base">
                {CATEGORY_LABELS[cat]} <span className="text-muted-foreground">({cat})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={categoryPrompts[cat] ?? ""}
                onChange={(e) => setCategory(cat, e.target.value)}
                className="min-h-[160px] font-mono text-sm"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 pb-8">
        <Button onClick={save} disabled={saving}>
          {saving ? "保存中…" : "保存到数据库"}
        </Button>
        <Button type="button" variant="outline" onClick={resetToBuiltin} disabled={!defaults}>
          表单填回内置默认（未写库）
        </Button>
        <Button type="button" variant="secondary" onClick={clearDbAndUseBuiltin} disabled={saving}>
          清除库中配置
        </Button>
        <Button type="button" variant="ghost" onClick={fetchData} disabled={saving}>
          重新加载
        </Button>
      </div>
    </div>
  );
}
