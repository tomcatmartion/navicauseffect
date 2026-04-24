"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalysisResult } from "./analysis-result";
import {
  PromptPreviewDialog,
  type PromptMessageLite,
} from "./prompt-preview-dialog";
import {
  RAG_DEBUG_STORAGE_KEY,
  type RagDebugStoredData,
} from "@/lib/rag/rag-debug-shared";

function normalizePromptMessages(raw: unknown): PromptMessageLite[] {
  if (!Array.isArray(raw)) return [];
  const out: PromptMessageLite[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (typeof role === "string" && typeof content === "string") {
      out.push({ role, content });
    }
  }
  return out;
}

const ANALYSIS_CATEGORIES = [
  { id: "PERSONALITY" as const, label: "性格分析", icon: "🔮", desc: "从命宫主星解读性格密码" },
  { id: "FORTUNE" as const, label: "总体运势", icon: "🌟", desc: "结合大限与流年的综合运势" },
  { id: "MARRIAGE" as const, label: "感情婚姻", icon: "💕", desc: "夫妻宫与桃花星深度分析" },
  { id: "CAREER" as const, label: "事业财运", icon: "📈", desc: "官禄宫与财帛宫联合解读" },
  { id: "HEALTH" as const, label: "身体健康", icon: "🌿", desc: "疾厄宫身心健康指南" },
  { id: "PARENT_CHILD" as const, label: "亲子关系", icon: "👨‍👩‍👧", desc: "子女宫与父母宫关系分析" },
  { id: "EMOTION" as const, label: "情绪疏导", icon: "🧘", desc: "福德宫情绪模式与心理支持" },
];

/** 第 8 个入口：见真连线，仅弹窗不调分析接口 */
const LIANXIAN_ENTRY = { id: "LIANXIAN" as const, label: "见真连线", icon: "💬" };

const ALL_CARDS = [...ANALYSIS_CATEGORIES, LIANXIAN_ENTRY];

type CategoryId = (typeof ANALYSIS_CATEGORIES)[number]["id"];

interface AIModel {
  id: string;
  name: string;
  provider: string;
  isDefault: boolean;
}

interface AnalysisPanelProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  astrolabeData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  horoscopeData?: any;
}

export function AnalysisPanel({
  astrolabeData,
  horoscopeData,
}: AnalysisPanelProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [userSupplement, setUserSupplement] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [reasoning, setReasoning] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [vipCategories, setVipCategories] = useState<string[]>([]);
  const [lianxianDialogOpen, setLianxianDialogOpen] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [promptMessages, setPromptMessages] = useState<PromptMessageLite[]>([]);

  // RAG 调试模式
  const [ragDebugMode, setRagDebugMode] = useState(false);

  const isPremium =
    session?.user?.membershipPlan === "MONTHLY" ||
    session?.user?.membershipPlan === "QUARTERLY" ||
    session?.user?.membershipPlan === "YEARLY";

  // 从 localStorage 恢复调试模式
  useEffect(() => {
    const stored = localStorage.getItem("rag_debug_mode");
    setRagDebugMode(stored === "true");
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: AIModel[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setModels(data);
          const defaultModel = data.find((m) => m.isDefault) || data[0];
          setSelectedModelId(defaultModel.id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/analysis/modules-config")
      .then((r) => r.json())
      .then((data: { vipCategories?: string[] }) => {
        if (Array.isArray(data?.vipCategories) && data.vipCategories.length > 0) {
          setVipCategories(data.vipCategories);
        } else {
          setVipCategories(["MARRIAGE", "CAREER", "HEALTH", "PARENT_CHILD", "EMOTION"]);
        }
      })
      .catch(() => setVipCategories(["MARRIAGE", "CAREER", "HEALTH", "PARENT_CHILD", "EMOTION"]));
  }, []);

  const handleAnalyze = async (categoryId: CategoryId) => {
    if (results[categoryId]) {
      setActiveCategory(categoryId);
      return;
    }

    setActiveCategory(categoryId);
    setLoading(categoryId);

    // RAG 调试模式：先获取上下文，不调 LLM
    if (ragDebugMode) {
      try {
        const response = await fetch("/api/analysis/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: categoryId,
            astrolabeData,
            horoscopeData,
            modelId: selectedModelId || undefined,
            userQuestion: userSupplement[categoryId] || undefined,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          setResults((prev) => ({
            ...prev,
            [categoryId]: `获取上下文失败: ${err.error || "请稍后重试"}`,
          }));
          setLoading(null);
          return;
        }
        const data = await response.json();
        // 存入 sessionStorage 并导航到调试页面
        const stored: RagDebugStoredData = {
          contextId: data.contextId,
          queryTexts: data.queryTexts ?? [],
          promptMessages: normalizePromptMessages(data.promptMessages),
          ragMeta: data.ragMeta ?? null,
          category: categoryId,
          categoryLabel:
            ANALYSIS_CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId,
        };
        sessionStorage.setItem(RAG_DEBUG_STORAGE_KEY, JSON.stringify(stored));
        setLoading(null);
        router.push("/chart/debug");
        return;
      } catch (err) {
        console.error("RAG context error:", err);
        setResults((prev) => ({
          ...prev,
          [categoryId]: "获取上下文时出现错误，请稍后重试。",
        }));
        setLoading(null);
      }
      return;
    }

    // 正常模式：直接调 /api/analysis
    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: categoryId,
          astrolabeData,
          horoscopeData,
          modelId: selectedModelId || undefined,
          showPromptOverlay: true,
          userQuestion: userSupplement[categoryId] || undefined,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 403 && (err.needUpgrade || err.needLogin)) {
          const msg = err.needLogin
            ? (err.error || "请先登录后再使用本模块，登录后可升级 VIP 或按次付费。")
            : (err.error || "请升级为 VIP 或充值单次付费后再使用本模块。您可前往「定价」页升级或按次付费。");
          setResults((prev) => ({
            ...prev,
            [categoryId]: `[权限提示] ${msg}`,
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [categoryId]: `分析请求失败: ${err.error || "请稍后重试"}`,
          }));
        }
        setLoading(null);
        return;
      }

      // 存档命中：接口直接返回 JSON
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data.cached && typeof data.content === "string") {
          const pm = normalizePromptMessages(data.promptMessages);
          if (pm.length > 0) {
            setPromptMessages(pm);
            setPromptPreviewOpen(true);
          }
          setResults((prev) => ({ ...prev, [categoryId]: data.content }));
        } else {
          setResults((prev) => ({
            ...prev,
            [categoryId]: data.content ?? "无缓存内容",
          }));
        }
        setLoading(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setResults((prev) => ({ ...prev, [categoryId]: "无法读取响应流" }));
        setLoading(null);
        return;
      }

      const decoder = new TextDecoder();
      let content = "";
      let reasoningText = "";
      /** 避免 TCP 分包截断在 data: 行中间导致 JSON.parse 失败 */
      let sseLineCarry = "";

      while (true) {
        const { done, value } = await reader.read();
        sseLineCarry += decoder.decode(value ?? new Uint8Array(), {
          stream: !done,
        });

        const flushLines = (all: string, isFinal: boolean) => {
          const lines = all.split("\n");
          const rest = isFinal ? "" : (lines.pop() ?? "");
          for (const raw of lines) {
            const line = raw.replace(/\r$/, "").trimStart();
            if (!line.toLowerCase().startsWith("data:")) continue;
            const payload = line.slice(5).trimStart();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as {
                naviMeta?: { kind?: string; messages?: unknown };
                choices?: Array<{
                  delta?: { content?: string; reasoning_content?: string };
                }>;
              };
              if (
                parsed.naviMeta?.kind === "analysis_prompt" &&
                parsed.naviMeta.messages
              ) {
                const pm = normalizePromptMessages(parsed.naviMeta.messages);
                if (pm.length > 0) {
                  setPromptMessages(pm);
                  setPromptPreviewOpen(true);
                }
                continue;
              }
              const d = parsed.choices?.[0]?.delta;
              // 分离 reasoning 和 content
              const reasoningPiece = typeof d?.reasoning_content === "string" ? d.reasoning_content : "";
              const contentPiece = typeof d?.content === "string" ? d.content : "";

              if (reasoningPiece) {
                reasoningText += reasoningPiece;
                setReasoning((prev) => ({ ...prev, [categoryId]: reasoningText }));
              }
              if (contentPiece) {
                content += contentPiece;
                setResults((prev) => ({ ...prev, [categoryId]: content }));
              }
            } catch {
              // 半行或非 JSON
            }
          }
          return rest;
        };

        if (done) {
          sseLineCarry = flushLines(sseLineCarry, true);
          break;
        }
        sseLineCarry = flushLines(sseLineCarry, false);
      }
      // 流结束但从未收到任何内容时也要写入一条结果，避免一直停在「开始分析」空状态
      if (!content) {
        setResults((prev) => ({
          ...prev,
          [categoryId]: "未收到分析内容，请检查网络或稍后重试。",
        }));
      }
    } catch (err) {
      console.error("Analysis error:", err);
      setResults((prev) => ({
        ...prev,
        [categoryId]: "分析过程中出现错误，请稍后重试。",
      }));
    } finally {
      setLoading(null);
    }
  };

  /** 从调试页返回后，自动读取 execute 标记并触发 LLM 调用 */
  const handleRagExecuteFromReturn = useCallback(async () => {
    const raw = sessionStorage.getItem("rag_debug_execute");
    if (!raw) return;
    sessionStorage.removeItem("rag_debug_execute");
    sessionStorage.removeItem(RAG_DEBUG_STORAGE_KEY);

    let contextId: string;
    let categoryId: CategoryId;
    try {
      const parsed = JSON.parse(raw);
      contextId = parsed.contextId;
      categoryId = parsed.category;
    } catch {
      return;
    }

    setActiveCategory(categoryId);
    setLoading(categoryId);

    try {
      const response = await fetch("/api/analysis/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId, category: categoryId, astrolabeData }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setResults((prev) => ({
          ...prev,
          [categoryId]: `执行失败: ${err.error || "请稍后重试"}`,
        }));
        setLoading(null);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setResults((prev) => ({ ...prev, [categoryId]: "无法读取响应流" }));
        setLoading(null);
        return;
      }

      const decoder = new TextDecoder();
      let content = "";
      let reasoningText = "";
      let sseLineCarry = "";

      while (true) {
        const { done, value } = await reader.read();
        sseLineCarry += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const flushLines = (all: string, isFinal: boolean) => {
          const lines = all.split("\n");
          const rest = isFinal ? "" : (lines.pop() ?? "");
          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, "").trimStart();
            if (!line.toLowerCase().startsWith("data:")) continue;
            const payload = line.slice(5).trimStart();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{
                  delta?: { content?: string; reasoning_content?: string };
                }>;
              };
              const d = parsed.choices?.[0]?.delta;
              const reasoningPiece = typeof d?.reasoning_content === "string" ? d.reasoning_content : "";
              const contentPiece = typeof d?.content === "string" ? d.content : "";
              if (reasoningPiece) {
                reasoningText += reasoningPiece;
                setReasoning((prev) => ({ ...prev, [categoryId]: reasoningText }));
              }
              if (contentPiece) {
                content += contentPiece;
                setResults((prev) => ({ ...prev, [categoryId]: content }));
              }
            } catch {
              // 半行或非 JSON
            }
          }
          return rest;
        };

        if (done) {
          sseLineCarry = flushLines(sseLineCarry, true);
          break;
        }
        sseLineCarry = flushLines(sseLineCarry, false);
      }

      if (!content) {
        setResults((prev) => ({
          ...prev,
          [categoryId]: "未收到分析内容，请检查网络或稍后重试。",
        }));
      }
    } catch (err) {
      console.error("RAG execute error:", err);
      setResults((prev) => ({
        ...prev,
        [categoryId]: "执行过程中出现错误，请稍后重试。",
      }));
    } finally {
      setLoading(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [astrolabeData]);

  // 页面加载时检查是否有从调试页返回的 execute 标记
  useEffect(() => {
    handleRagExecuteFromReturn();
  }, [handleRagExecuteFromReturn]);

  const toggleRagDebugMode = () => {
    const next = !ragDebugMode;
    setRagDebugMode(next);
    localStorage.setItem("rag_debug_mode", String(next));
  };

  const handleModelChange = (newModelId: string) => {
    setSelectedModelId(newModelId);
    setResults({});
    setReasoning({});
  };

  const effectiveModel = selectedModelId
    ? models.find((m) => m.id === selectedModelId)
    : models.find((m) => m.isDefault) ?? models[0];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 font-[var(--font-serif-sc)] text-xl font-bold text-primary md:text-2xl">
          AI 智能解析
        </h2>
        <p className="text-sm text-muted-foreground">
          选择分析模块，AI 将融合紫微智慧与心理学为你深度解读
        </p>
        {effectiveModel && (
          <p className="mt-2 text-xs text-muted-foreground">
            当前使用模型：<span className="font-medium text-foreground">{effectiveModel.name}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {models.length > 1 && (
          <>
            <span className="text-sm text-muted-foreground">AI 模型：</span>
            <Select value={selectedModelId} onValueChange={handleModelChange}>
              <SelectTrigger className="w-[200px] border-primary/20">
                <SelectValue placeholder="选择 AI 模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <span className="flex items-center gap-2">
                      {model.name}
                      {model.isDefault && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30">
                          默认
                        </Badge>
                      )}
                      {!isPremium && !model.isDefault && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-600">
                          会员
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Button
          type="button"
          variant={ragDebugMode ? "default" : "outline"}
          size="sm"
          className={`text-xs ${ragDebugMode ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : "border-dashed"}`}
          onClick={toggleRagDebugMode}
        >
          RAG 调试{ragDebugMode ? " ON" : ""}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        {ALL_CARDS.map((cat) => {
          const isLianxian = cat.id === "LIANXIAN";
          const isActive = !isLianxian && activeCategory === cat.id;
          return (
            <Card
              key={cat.id}
              className={`cursor-pointer border transition-all hover:shadow-md ${
                isLianxian
                  ? "border-violet-200 bg-violet-50/70 shadow-sm dark:border-violet-800 dark:bg-violet-950/20 hover:border-violet-300 hover:bg-violet-100/80 dark:hover:bg-violet-900/30"
                  : isActive
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-primary/10 hover:border-primary/30"
              }`}
              onClick={() => {
                if (isLianxian) setLianxianDialogOpen(true);
                else handleAnalyze(cat.id as CategoryId);
              }}
            >
              <CardContent className="flex flex-col items-center p-3 text-center">
                <span className="mb-1 text-2xl">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.label}</span>
                {!isLianxian && vipCategories.includes(cat.id) && (
                  <Badge
                    variant="outline"
                    className="mt-1 h-4 border-accent text-[9px] text-accent-foreground/60"
                  >
                    VIP探真
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PromptPreviewDialog
        open={promptPreviewOpen}
        onOpenChange={setPromptPreviewOpen}
        messages={promptMessages}
      />

      <Dialog open={lianxianDialogOpen} onOpenChange={setLianxianDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>见真连线</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-center text-muted-foreground">咨询师下班了</p>
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => setLianxianDialogOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {activeCategory && (
        <Card className="border-primary/15">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-primary">
              <span>
                {ANALYSIS_CATEGORIES.find((c) => c.id === activeCategory)?.icon}
              </span>
              {ANALYSIS_CATEGORIES.find((c) => c.id === activeCategory)?.label}
              {loading === activeCategory && (
                <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              {selectedModelId && models.length > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {models.find((m) => m.id === selectedModelId)?.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* 用户补充输入框（帮助 AI 更精准检索知识库） */}
            {!results[activeCategory] && loading !== activeCategory && (
              <div className="mb-4">
                <textarea
                  value={userSupplement[activeCategory] || ""}
                  onChange={(e) =>
                    setUserSupplement((prev) => ({
                      ...prev,
                      [activeCategory]: e.target.value,
                    }))
                  }
                  placeholder="可选：补充你想重点了解的方面，帮助 AI 更精准分析（如：我最关心事业发展的时机）"
                  rows={2}
                  className="w-full resize-none rounded-md border border-primary/15 bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}
            <AnalysisResult
              content={results[activeCategory] || ""}
              reasoning={reasoning[activeCategory] || ""}
              loading={loading === activeCategory}
            />
            {(results[activeCategory] || "").startsWith("[权限提示]") && (
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                {(results[activeCategory] || "").includes("请先登录") && (
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <Link href="/auth/login">去登录</Link>
                  </Button>
                )}
                <Button variant="outline" asChild className="border-primary/40">
                  <Link href="/pricing">前往定价 · 升级 VIP 或按次付费</Link>
                </Button>
              </div>
            )}
            {!loading && !results[activeCategory] && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  点击下方按钮开始 AI 分析
                </p>
                <Button
                  type="button"
                  onClick={() => handleAnalyze(activeCategory)}
                  className="bg-primary hover:bg-primary/90"
                >
                  开始分析
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
