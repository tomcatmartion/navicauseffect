"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── 类型 ───

interface RagTestResult {
  queryTexts: string[];
  queryVariants: string[];
  singleQuery: string;
  resolvedCategory?: string;
  retrievalResults: Array<{
    id: string;
    score: number;
    text: string;
    sourceFile: string;
    bizModules: string[];
    palaces: string[];
    stars: string[];
  }>;
  knowledgeText: string;
  systemPrompt: string;
  userMessage: string;
  ragMeta: {
    knowledgeLength: number;
    topk: number;
    truncated: boolean;
    filterSteps: Array<{ label: string; hitCount: number }>;
    hits: number;
    totalHits: number;
  } | null;
  provider: string;
  modelId: string;
  family: string;
  categoryPrompt?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  PERSONALITY: "性格分析",
  FORTUNE: "综合运势",
  MARRIAGE: "感情婚姻",
  CAREER: "事业财运",
  HEALTH: "健康提示",
  PARENT_CHILD: "亲子关系",
  EMOTION: "情绪心理",
};

// ─── 主组件 ───

export default function RagTestPage() {
  const [query, setQuery] = useState("");
  const [topk, setTopk] = useState(12);
  const [family, setFamily] = useState("");
  const [astrolabeJson, setAstrolabeJson] = useState("");
  const [showAstrolabe, setShowAstrolabe] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<RagTestResult | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("请输入检索语句"); return; }
    setSearching(true);
    setError("");
    setResult(null);

    // 解析可选的命盘 JSON
    let astrolabeData: Record<string, unknown> | undefined;
    if (astrolabeJson.trim()) {
      try {
        astrolabeData = JSON.parse(astrolabeJson.trim());
      } catch {
        setError("命盘 JSON 格式错误，请检查后重试");
        setSearching(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/rag-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          category: "AUTO",
          topk,
          family: family || undefined,
          astrolabeData,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "检索失败"); return; }
      setResult(data);
    } catch {
      setError("网络请求失败");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">RAG 检索测试</h2>
        <p className="text-sm text-muted-foreground">输入检索语句，测试知识库检索效果（类别自动推断，与前端实际使用逻辑一致）</p>
      </div>

      {/* 输入区 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">检索语句</label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入要检索的内容，如：我的财运怎么样？"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="w-full md:w-24">
              <label className="mb-1 block text-sm font-medium">TopK</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={topk}
                onChange={(e) => setTopk(Number(e.target.value) || 12)}
              />
            </div>
            <div className="w-full md:w-28">
              <label className="mb-1 block text-sm font-medium">维度</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              >
                <option value="">自动</option>
                <option value="1536">1536 维</option>
                <option value="1024">1024 维</option>
              </select>
            </div>
            <Button onClick={handleSearch} disabled={searching} className="md:w-24">
              {searching ? "检索中..." : "检索"}
            </Button>
          </div>
          {/* 可选命盘数据 */}
          <div className="mt-3">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAstrolabe(!showAstrolabe)}
            >
              {showAstrolabe ? "收起" : "展开"}命盘数据（可选，提升检索相关性）
            </button>
            {showAstrolabe && (
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs font-mono"
                rows={6}
                value={astrolabeJson}
                onChange={(e) => setAstrolabeJson(e.target.value)}
                placeholder='粘贴 astrolabe JSON，如：{"soul":"紫微","body":"天相","palaces":[{"name":"命宫","majorStars":[{"name":"紫微"}]}]}'
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-3 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      {/* 结果展示 */}
      {result && (
        <Tabs defaultValue="queries">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="queries">检索词</TabsTrigger>
            <TabsTrigger value="results">RAG 结果</TabsTrigger>
            <TabsTrigger value="system">System Prompt</TabsTrigger>
            <TabsTrigger value="full">完整数据</TabsTrigger>
          </TabsList>

          {/* Tab 1: 检索词 */}
          <TabsContent value="queries">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">生成的检索词</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">主 Query（buildRagQueryText）</p>
                  <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs leading-relaxed">{result.singleQuery}</pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">检索词变体（buildRagQueryVariants，共 {result.queryVariants.length} 条）</p>
                  {result.queryVariants.map((v, i) => (
                    <pre key={i} className="mb-2 whitespace-pre-wrap rounded border bg-muted/50 p-3 text-xs leading-relaxed">
                      <span className="font-medium">变体 {i + 1}:</span>{"\n"}{v}
                    </pre>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">最终检索词（retrieveLogicdocQueryTexts 输出）</p>
                  {result.queryTexts.map((t, i) => (
                    <pre key={i} className="mb-2 whitespace-pre-wrap rounded border bg-blue-50 p-3 text-xs leading-relaxed">
                      <span className="font-medium">检索词 {i + 1}:</span>{"\n"}{t}
                    </pre>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: RAG 检索结果 */}
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">RAG 检索结果</CardTitle>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>模型: {result.provider}/{result.modelId}</span>
                    <span>维度: {result.family}</span>
                    {result.resolvedCategory && (
                      <span>推断类别: {CATEGORY_LABELS[result.resolvedCategory] ?? result.resolvedCategory}</span>
                    )}
                    <span>命中: {result.retrievalResults.length} 条</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.ragMeta && (
                  <div className="rounded border bg-muted/30 p-3 text-xs">
                    <div className="flex flex-wrap gap-3">
                      <span>知识文本长度: {result.ragMeta.knowledgeLength} 字符</span>
                      <span>TopK: {result.ragMeta.topk}</span>
                      <span>截断: {result.ragMeta.truncated ? "是" : "否"}</span>
                      <span>Hits: {Array.isArray(result.ragMeta.hits) ? result.ragMeta.hits.length : result.ragMeta.hits}</span>
                      <span>TotalHits: {result.ragMeta.totalHits}</span>
                    </div>
                    {result.ragMeta.filterSteps.length > 0 && (
                      <div className="mt-2">过滤步骤: {result.ragMeta.filterSteps.map(s => `${s.label}(${s.hitCount})`).join(" → ")}</div>
                    )}
                    {Array.isArray(result.ragMeta.hits) && result.ragMeta.hits.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="font-medium">命中片段:</div>
                        {result.ragMeta.hits.map((hit: { index: number; sourceFile: string; textLength: number; preview: string }, i: number) => (
                          <div key={i} className="rounded border bg-background p-2">
                            <div className="flex gap-2 text-muted-foreground">
                              <span>#{hit.index}</span>
                              <span>{hit.sourceFile}</span>
                              <span>{hit.textLength} 字符</span>
                            </div>
                            <div className="mt-1 truncate text-muted-foreground">{hit.preview}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {result.retrievalResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">未检索到相关结果</p>
                ) : (
                  result.retrievalResults.map((r, idx) => (
                    <div key={r.id} className="rounded-lg border bg-card p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                        <Badge variant="outline" className="text-xs">Score: {r.score.toFixed(4)}</Badge>
                        <span className="text-xs text-muted-foreground">{r.sourceFile}</span>
                        <div className="flex gap-1">
                          {r.bizModules.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{r.text}</pre>
                      {(r.palaces.length > 0 || r.stars.length > 0) && (
                        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                          {r.palaces.length > 0 && <span>宫位: {r.palaces.join(", ")}</span>}
                          {r.stars.length > 0 && <span>星曜: {r.stars.join(", ")}</span>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: System Prompt */}
          <TabsContent value="system">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prompt 结构</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">System Message（通用咨询师 prompt + 知识注入，{result.systemPrompt.length} 字符）</p>
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded bg-muted p-4 text-xs leading-relaxed">{result.systemPrompt}</pre>
                </div>
                {result.categoryPrompt && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">分类 Prompt（在 User Message 中发送给模型，{result.categoryPrompt.length} 字符）</p>
                    <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded bg-blue-50 p-4 text-xs leading-relaxed">{result.categoryPrompt}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 4: 完整数据 */}
          <TabsContent value="full">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">发送给大模型的完整 Messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">System Message（{result.systemPrompt.length} 字符）</p>
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded bg-muted p-4 text-xs leading-relaxed">{result.systemPrompt}</pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">User Message（{result.userMessage.length} 字符）</p>
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded bg-blue-50 p-4 text-xs leading-relaxed">{result.userMessage}</pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">注入的向量化知识（{result.knowledgeText.length} 字符）</p>
                  <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded bg-green-50 p-4 text-xs leading-relaxed">{result.knowledgeText}</pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
