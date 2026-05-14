"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getEmbeddingFamilyForProvider } from "@/lib/zvec/embedding-family";

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string;
  isActive: boolean;
  isDefault: boolean;
  hasApiKey?: boolean;
}

interface FormData {
  name: string;
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
}

const PROVIDERS: { id: string; label: string; baseUrl: string; modelId: string }[] = [
  {
    id: "minimax",
    label: "MiniMax（Embedding 1536 维）",
    baseUrl: "https://api.minimaxi.com/v1",
    modelId: "MiniMax-M2",
  },
  {
    id: "openai",
    label: "OpenAI / GPT（Embedding 1536 维）",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-4o-mini",
  },
  {
    id: "google",
    label: "Google Gemini / Gemma（Embedding 1536 维）",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    modelId: "gemini-2.0-flash",
  },
  { id: "zhipu", label: "智谱 GLM（Embedding 1024 维）", baseUrl: "https://open.bigmodel.cn/api/paas/v4", modelId: "glm-4-flash" },
  { id: "deepseek", label: "DeepSeek（Embedding 1024 维）", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-chat" },
  {
    id: "deepseek-anthropic",
    label: "DeepSeek V4（Anthropic 协议 / Embedding 1024 维）",
    baseUrl: "https://api.deepseek.com/anthropic",
    modelId: "deepseek-v4-pro[1m]",
  },
  { id: "qwen", label: "通义千问（Embedding 1024 维）", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", modelId: "qwen-turbo" },
  {
    id: "doubao",
    label: "豆包 / 火山（Embedding 1024 维）",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    modelId: "doubao-pro-32k",
  },
  { id: "claude", label: "Claude（Embedding 1536 维）", baseUrl: "https://api.anthropic.com", modelId: "claude-3-sonnet-20240229" },
];

const emptyForm: FormData = {
  name: "",
  provider: "",
  modelId: "",
  baseUrl: "",
  apiKey: "",
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/models");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setModels(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const fillProvider = (providerId: string) => {
    const p = PROVIDERS.find((x) => x.id === providerId);
    if (p) {
      setForm((f) => ({
        ...f,
        provider: p.id,
        baseUrl: p.baseUrl,
        modelId: p.modelId,
        name: f.name || p.label,
      }));
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = async (model: ModelConfig) => {
    setEditingId(model.id);
    setForm({
      name: model.name,
      provider: model.provider,
      modelId: model.modelId,
      baseUrl: model.baseUrl,
      apiKey: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          id: editingId,
          name: form.name,
          provider: form.provider,
          modelId: form.modelId,
          baseUrl: form.baseUrl,
        };
        if (form.apiKey.trim()) payload.apiKey = form.apiKey;
        const res = await fetch("/api/admin/models", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "更新失败");
        }
      } else {
        if (!form.apiKey.trim()) throw new Error("新建模型必须填写 API Key");
        const res = await fetch("/api/admin/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "创建失败");
        }
      }
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (model: ModelConfig) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id, isActive: !model.isActive }),
      });
      if (!res.ok) throw new Error("操作失败");
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  };

  const setDefault = async (model: ModelConfig) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id, isDefault: true }),
      });
      if (!res.ok) throw new Error("操作失败");
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确认删除此模型配置？删除后不可恢复。")) return;
    try {
      const res = await fetch(`/api/admin/models?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setDialogOpen(false);
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  };

  const dialogTitle = editingId ? "编辑 AI 模型" : "添加 AI 模型";

  const providerHint =
    form.provider === "minimax"
      ? "MiniMax：在 https://platform.minimaxi.com/ 创建 API Key。OpenAI 兼容 Base URL 一般为 https://api.minimaxi.com/v1（勿尾斜杠）；模型名如 MiniMax-M2、MiniMax-M2.5 等以控制台为准。"
      : null;

  const ragFamily = form.provider
    ? getEmbeddingFamilyForProvider(form.provider)
    : null;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        所有大模型（含 <strong className="text-foreground">MiniMax</strong>
        ）均在下方配置：填写 API Key、Base URL、Model ID，并可将一条设为<strong className="text-foreground">默认</strong>
        。密钥仅存数据库，不写 .env。
      </p>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">AI 模型配置</h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingId(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>添加模型</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>模型名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：智谱 GLM-4"
                />
              </div>
              <div className="space-y-2">
                <Label>提供商</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v) => fillProvider(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择提供商" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {providerHint && (
                <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  {providerHint}
                </p>
              )}
              {ragFamily && (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  解盘知识库 RAG：当前厂商对应{" "}
                  <strong className="text-foreground">{ragFamily} 维</strong>{" "}
                  向量索引与 Embedding；请在「Embedding」页配置同维度模型并完成索引。
                </p>
              )}
              <div className="space-y-2">
                <Label>Model ID</Label>
                <Input
                  value={form.modelId}
                  onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                  placeholder="例如：glm-4-flash"
                />
              </div>
              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="https://open.bigmodel.cn/api/paas/v4"
                />
              </div>
              <div className="space-y-2">
                <Label>API Key {editingId && <span className="text-muted-foreground font-normal">（留空则不修改）</span>}</Label>
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder={editingId ? "留空则不修改" : "sk-..."}
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.provider || !form.modelId || !form.baseUrl || (!editingId && !form.apiKey.trim())}
                >
                  {saving ? "保存中..." : "保存"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleDelete(editingId)}
                    disabled={saving}
                  >
                    删除
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {models.length === 0 && !error && (
        <div className="py-12 text-center text-muted-foreground">
          暂无模型配置，点击「添加模型」开始。可选择 MiniMax、DeepSeek、智谱等在排盘页使用 AI 解盘；至少启用一条并设默认。
        </div>
      )}

      <div className="grid gap-4">
        {models.map((model) => (
          <Card key={model.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{model.name}</h3>
                    {model.isDefault && <Badge className="bg-primary">默认</Badge>}
                    {model.isActive && !model.isDefault && (
                      <Badge variant="outline">已启用</Badge>
                    )}
                    {!model.isActive && (
                      <Badge variant="secondary">已禁用</Badge>
                    )}
                    {model.hasApiKey === false && (
                      <Badge variant="secondary">未配置 Key</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {model.provider} · {model.modelId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => openEdit(model)}>
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDefault(model)}
                  disabled={model.isDefault}
                >
                  设为默认
                </Button>
                <Switch
                  checked={model.isActive}
                  onCheckedChange={() => toggleActive(model)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
