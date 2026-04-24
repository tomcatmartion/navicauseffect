"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DimState = {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  hasApiKey: boolean;
  /** MiniMax 等：写入请求体 group_id，可选 */
  groupId: string;
};

const emptyDim = (): DimState => ({
  baseUrl: "",
  modelId: "",
  apiKey: "",
  hasApiKey: false,
  groupId: "",
});

export default function AdminEmbeddingPage() {
  const [dim1536, setDim1536] = useState<DimState>(emptyDim);
  const [dim1024, setDim1024] = useState<DimState>(emptyDim);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [reindexMsg, setReindexMsg] = useState("");
  const [testingFamily, setTestingFamily] = useState<"1536" | "1024" | null>(
    null
  );
  const [testMsg, setTestMsg] = useState("");

  const fetchData = useCallback(async (opts?: { skipLoading?: boolean }) => {
    const skip = opts?.skipLoading === true;
    if (!skip) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch(
        `/api/admin/embedding-config?_=${Date.now()}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );
      if (!res.ok) throw new Error("加载失败");
      const data = (await res.json()) as {
        dim1536: {
          baseUrl: string;
          modelId: string;
          hasApiKey: boolean;
          groupId?: string;
        };
        dim1024: {
          baseUrl: string;
          modelId: string;
          hasApiKey: boolean;
          groupId?: string;
        };
      };
      setDim1536({
        baseUrl: data.dim1536.baseUrl,
        modelId: data.dim1536.modelId,
        apiKey: "",
        hasApiKey: data.dim1536.hasApiKey,
        groupId: data.dim1536.groupId ?? "",
      });
      setDim1024({
        baseUrl: data.dim1024.baseUrl,
        modelId: data.dim1024.modelId,
        apiKey: "",
        hasApiKey: data.dim1024.hasApiKey,
        groupId: data.dim1024.groupId ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (!skip) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/embedding-config", {
        method: "PUT",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dim1536: {
            baseUrl: dim1536.baseUrl,
            modelId: dim1536.modelId,
            apiKey: dim1536.apiKey || undefined,
            groupId: dim1536.groupId,
          },
          dim1024: {
            baseUrl: dim1024.baseUrl,
            modelId: dim1024.modelId,
            apiKey: dim1024.apiKey || undefined,
            groupId: dim1024.groupId,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "保存失败");
      }
      const saved = (await res.json()) as {
        ok?: boolean;
        dim1536?: {
          baseUrl: string;
          modelId: string;
          hasApiKey: boolean;
          groupId?: string;
        };
        dim1024?: {
          baseUrl: string;
          modelId: string;
          hasApiKey: boolean;
          groupId?: string;
        };
      };
      if (saved.dim1536 && saved.dim1024) {
        setDim1536({
          baseUrl: saved.dim1536.baseUrl,
          modelId: saved.dim1536.modelId,
          apiKey: "",
          hasApiKey: saved.dim1536.hasApiKey,
          groupId: saved.dim1536.groupId ?? "",
        });
        setDim1024({
          baseUrl: saved.dim1024.baseUrl,
          modelId: saved.dim1024.modelId,
          apiKey: "",
          hasApiKey: saved.dim1024.hasApiKey,
          groupId: saved.dim1024.groupId ?? "",
        });
      }
      setSuccess("已保存。若修改了模型或密钥，建议执行一次「重建 logicdoc 索引」。");
      await fetchData({ skipLoading: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const testEmbedding = async (family: "1536" | "1024") => {
    setTestingFamily(family);
    setError("");
    setTestMsg("");
    const loadingId = toast.loading(`正在测试 ${family} 维 Embedding…`);
    try {
      const res = await fetch("/api/admin/embedding-config/test", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        dimension?: number;
        expectedDimension?: number;
        modelId?: string;
      };
      if (!res.ok || !j.ok) {
        throw new Error(
          typeof j.error === "string" ? j.error : `测试失败（HTTP ${res.status}）`
        );
      }
      toast.dismiss(loadingId);
      toast.success(
        `${family} 维连通成功：向量维度 ${j.dimension}（要求 ${j.expectedDimension}），模型 ${j.modelId ?? "?"}`
      );
      setTestMsg(
        `${family} 维：接口正常，返回向量维度 ${j.dimension}（与 Zvec 要求 ${j.expectedDimension} 一致），模型 ${j.modelId ?? "?" }。分析请求将使用本套配置。`
      );
    } catch (e) {
      toast.dismiss(loadingId);
      const msg = e instanceof Error ? e.message : "测试失败";
      toast.error(msg);
      setError(msg);
    } finally {
      setTestingFamily(null);
    }
  };

  const reindex = async () => {
    setReindexing(true);
    setReindexMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/logicdoc-reindex", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "重建失败");
      }
      setReindexMsg(
        `完成：文件 ${j.stats?.files ?? "?"}，块 ${j.stats?.chunks ?? "?"}，` +
          `1536 维 API 调用 ${j.stats?.apiCalls1536 ?? "?"}，` +
          `1024 维 ${j.stats?.apiCalls1024 ?? "?"}，` +
          `跳过未改块 ${j.stats?.skippedPairs ?? "?"}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "重建失败");
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Embedding · 向量库</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          两套配置对应双 Zvec 集合（严格 <strong className="text-foreground">1536</strong> /{" "}
          <strong className="text-foreground">1024</strong> 维），与对话模型供应商族一致。
          Base URL 填 OpenAI 兼容<strong className="text-foreground">根路径</strong>即可（如{" "}
          <code className="text-xs">https://api.openai.com/v1</code>、
          <code className="text-xs">https://open.bigmodel.cn/api/paas/v4</code>
          ），系统会请求 <code className="text-xs">…/embeddings</code>；若你已填到{" "}
          <code className="text-xs">…/embeddings</code> 结尾，也会自动识别，不会重复拼接。
          Model ID 必须是<strong className="text-foreground">Embedding 模型名</strong>
          （不是对话模型）。<strong className="text-foreground">MiniMax</strong> 使用原生字段{" "}
          <code className="text-xs">texts</code> +{" "}
          <code className="text-xs">type</code>（db / query），返回{" "}
          <code className="text-xs">vectors</code> +{" "}
          <code className="text-xs">base_resp</code>；检测到 MiniMax Base URL 时会自动切换请求体。若走 OpenAI 兼容网关，可设环境变量{" "}
          <code className="text-xs">EMBEDDING_FORCE_OPENAI_EMBEDDING_BODY=1</code>。
          MiniMax 若报 <code className="text-xs">invalid params</code>，多为需在下方填写{" "}
          <strong className="text-foreground">Group ID</strong>（控制台可查）。
          保存时每一套须同时具备 Base URL、Model ID、API Key 才会写入；可只保存其中一套。
          API Key 留空表示沿用库内已存密钥。配置以数据库为准，无记录时才读{" "}
          <code className="text-xs">.env</code> 的 <code className="text-xs">EMBEDDING_*</code>。
          更换 embedding 模型后须<strong className="text-foreground">重建 logicdoc 索引</strong>。
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          点击「测试连接」后：右上角会弹出 Toast；本页下方也会保留一行绿色（成功）或红色（失败）摘要。若长时间只有「测试中…」，多为外网 API 较慢或超时（默认约 120s）。
        </p>
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
          <strong className="font-medium">计费说明：</strong>
          Embedding 按厂商规则计费。若提示{" "}
          <code className="text-xs">insufficient balance</code> / 余额不足，属于
          <strong>账户未充值或额度用尽</strong>，需在 MiniMax、智谱、OpenAI
          等<strong>服务商控制台</strong>充值或换 Key，不是程序缺陷。可选环境变量{" "}
          亦可设环境变量 <code className="text-xs">EMBEDDING_*_GROUP_ID</code> /{" "}
          <code className="text-xs">EMBEDDING_MINIMAX_GROUP_ID</code> 作为兜底（后台填写优先）。
        </div>
      </div>

      {!loading ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">最近一次操作结果</p>
          {error ? (
            <p className="text-sm text-destructive whitespace-pre-wrap break-words">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          ) : null}
          {testMsg ? (
            <p className="text-sm text-green-600 dark:text-green-400">{testMsg}</p>
          ) : null}
          {reindexMsg ? (
            <p className="text-sm text-muted-foreground">{reindexMsg}</p>
          ) : null}
          {!error && !success && !testMsg && !reindexMsg ? (
            <p className="text-sm text-muted-foreground">尚无（保存、测试或重建后会显示在这里）</p>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1536 维（MiniMax / Claude / OpenAI 等）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="b1536">Base URL</Label>
                <Input
                  id="b1536"
                  value={dim1536.baseUrl}
                  onChange={(e) =>
                    setDim1536((d) => ({ ...d, baseUrl: e.target.value }))
                  }
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m1536">Model ID</Label>
                <Input
                  id="m1536"
                  value={dim1536.modelId}
                  onChange={(e) =>
                    setDim1536((d) => ({ ...d, modelId: e.target.value }))
                  }
                  placeholder="text-embedding-3-small"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k1536">
                  API Key{dim1536.hasApiKey ? "（留空保留已存密钥）" : ""}
                </Label>
                <Input
                  id="k1536"
                  type="password"
                  autoComplete="off"
                  value={dim1536.apiKey}
                  onChange={(e) =>
                    setDim1536((d) => ({ ...d, apiKey: e.target.value }))
                  }
                  placeholder={dim1536.hasApiKey ? "••••••••" : "必填"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g1536">Group ID（可选，MiniMax 等需 group_id 时填写）</Label>
                <Input
                  id="g1536"
                  autoComplete="off"
                  value={dim1536.groupId}
                  onChange={(e) =>
                    setDim1536((d) => ({ ...d, groupId: e.target.value }))
                  }
                  placeholder="控制台 Group ID，无则留空"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingFamily !== null}
                onClick={() => testEmbedding("1536")}
              >
                {testingFamily === "1536" ? "测试中…" : "测试 1536 维连接"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">1024 维（智谱 / DeepSeek / 千问 等）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="b1024">Base URL</Label>
                <Input
                  id="b1024"
                  value={dim1024.baseUrl}
                  onChange={(e) =>
                    setDim1024((d) => ({ ...d, baseUrl: e.target.value }))
                  }
                  placeholder="https://open.bigmodel.cn/api/paas/v4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m1024">Model ID</Label>
                <Input
                  id="m1024"
                  value={dim1024.modelId}
                  onChange={(e) =>
                    setDim1024((d) => ({ ...d, modelId: e.target.value }))
                  }
                  placeholder="embedding-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k1024">
                  API Key{dim1024.hasApiKey ? "（留空保留已存密钥）" : ""}
                </Label>
                <Input
                  id="k1024"
                  type="password"
                  autoComplete="off"
                  value={dim1024.apiKey}
                  onChange={(e) =>
                    setDim1024((d) => ({ ...d, apiKey: e.target.value }))
                  }
                  placeholder={dim1024.hasApiKey ? "••••••••" : "必填"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g1024">Group ID（可选，MiniMax 等需 group_id 时填写）</Label>
                <Input
                  id="g1024"
                  autoComplete="off"
                  value={dim1024.groupId}
                  onChange={(e) =>
                    setDim1024((d) => ({ ...d, groupId: e.target.value }))
                  }
                  placeholder="控制台 Group ID，无则留空"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={testingFamily !== null}
                onClick={() => testEmbedding("1024")}
              >
                {testingFamily === "1024" ? "测试中…" : "测试 1024 维连接"}
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={saving}>
              {saving ? "保存中…" : "保存配置"}
            </Button>
            <Button variant="secondary" onClick={reindex} disabled={reindexing}>
              {reindexing ? "重建中…" : "重建 logicdoc 索引"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
