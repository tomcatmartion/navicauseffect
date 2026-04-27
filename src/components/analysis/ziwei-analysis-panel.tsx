"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

type AnalysisType =
  | "palace"
  | "all-palaces"
  | "personality"
  | "interaction"
  | "affair"
  | "full"
  | "patterns";

interface ZiweiAnalysisPanelProps {
  birthData: {
    gender: "MALE" | "FEMALE";
    year: number;
    month: number;
    day: number;
    hour: number;
    solar?: boolean;
  };
  currentAge?: number;
}

const ANALYSIS_OPTIONS = [
  { id: "patterns" as const, label: "格局识别", icon: "🏆" },
  { id: "all-palaces" as const, label: "宫位能级", icon: "📊" },
  { id: "personality" as const, label: "性格分析", icon: "🔮" },
  { id: "affair" as const, label: "事项分析", icon: "🎯" },
];

const AFFAIR_TYPES = [
  { value: "求学", label: "求学/考试" },
  { value: "求爱", label: "感情恋爱" },
  { value: "求财", label: "财运投资" },
  { value: "求职", label: "工作事业" },
  { value: "求健康", label: "身体健康" },
  { value: "求名", label: "名声发展" },
];

const EFFECT_LABELS: Record<string, string> = {
  positive: "吉利",
  negative: "凶象",
  mixed: "吉凶参半",
};

// 吉凶对应的色条颜色
const EFFECT_COLORS: Record<string, string> = {
  positive: "bg-emerald-500",
  negative: "bg-rose-500",
  mixed: "bg-amber-500",
};

export function ZiweiAnalysisPanel({ birthData, currentAge }: ZiweiAnalysisPanelProps) {
  const [activeType, setActiveType] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAffair, setSelectedAffair] = useState("求财");
  const [affairInput, setAffairInput] = useState("投资赚钱");

  const handleAnalyze = async (type: AnalysisType) => {
    // 再次点击同一个则收起
    if (activeType === type && result) {
      setActiveType(null);
      setResult(null);
      return;
    }
    setActiveType(type);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        type,
        birthData,
        currentAge,
      };

      if (type === "affair") {
        payload.affair = affairInput;
        payload.affairType = selectedAffair;
        payload.targetYear = { year: new Date().getFullYear() };
      }

      const response = await fetch("/api/ziwei/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "分析失败");
        return;
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  // ─── 格局识别：紧凑列表 ───
  const renderPatterns = (patterns: any[]) => {
    if (!patterns || patterns.length === 0) {
      return <p className="py-2 text-sm text-muted-foreground">未识别到特殊格局</p>;
    }

    const grouped = patterns.reduce((acc: Record<string, any[]>, p: any) => {
      const group = p.category || "其他";
      if (!acc[group]) acc[group] = [];
      acc[group].push(p);
      return acc;
    }, {} as Record<string, any[]>);

    return (
      <div className="space-y-3">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{category}格局</div>
            <div className="space-y-1">
              {items.map((p: any, i: number) => {
                const effect = p.effect as string;
                const barColor = effect === "positive" ? "bg-emerald-500" : effect === "negative" ? "bg-rose-500" : "bg-amber-500";
                return (
                  <div key={i} className="flex items-center gap-2 rounded py-1.5 pl-2 pr-1 text-sm border-l-[3px] border-l-current"
                    style={{ borderLeftColor: effect === "positive" ? "#10b981" : effect === "negative" ? "#f43f5e" : "#f59e0b" }}
                  >
                    <span className="shrink-0 font-medium">{p.name}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0">
                      {p.source === "natal" ? "原局" : p.source === "decennial" ? "大限" : p.source === "annual" ? "流年" : p.source}
                    </Badge>
                    <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0">
                      {EFFECT_LABELS[effect] || effect}
                    </Badge>
                    {p.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {p.description}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── 宫位能级：紧凑网格 ───
  const renderPalaces = (assessments: Record<string, any>) => {
    const entries = Object.entries(assessments);
    return (
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-primary/10 bg-primary/5">
        {entries.map(([branch, data]) => {
          const score = data.finalScore as number;
          return (
            <div
              key={branch}
              className="flex items-center justify-between bg-card px-2.5 py-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{data.palace as string}</span>
                <span className="ml-1 text-xs text-muted-foreground">{branch}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{data.level as string}</span>
                <Badge
                  variant={score >= 6 ? "default" : "secondary"}
                  className={`text-[10px] px-1.5 py-0 ${
                    score >= 8 ? "bg-emerald-600" : score >= 6 ? "bg-blue-600" : ""
                  }`}
                >
                  {score.toFixed(1)}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── 性格分析：紧凑展示 ───
  const renderPersonality = (profile: any) => {
    return (
      <div className="space-y-3 text-sm">
        {profile.overview && (
          <p className="text-muted-foreground leading-relaxed">{profile.overview}</p>
        )}

        {profile.traits && (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {profile.traits.surface?.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">表层</span>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {profile.traits.surface.map((t: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile.traits.core?.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">核心</span>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {profile.traits.core.map((t: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {profile.strengths?.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">优势</span>
            <p className="mt-0.5 text-muted-foreground">{profile.strengths.join("、")}</p>
          </div>
        )}

        {profile.weaknesses?.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">挑战</span>
            <p className="mt-0.5 text-muted-foreground">{profile.weaknesses.join("、")}</p>
          </div>
        )}

        {profile.advice && (
          <div>
            <span className="text-xs text-muted-foreground">建议</span>
            <p className="mt-0.5 text-muted-foreground">{profile.advice.overall}</p>
          </div>
        )}
      </div>
    );
  };

  // ─── 事项分析：紧凑展示 ───
  const renderAffair = (analysis: any) => {
    const conclusion = analysis.conclusion;
    const advice = analysis.advice;
    return (
      <div className="space-y-3 text-sm">
        {analysis.overview && (
          <p className="text-muted-foreground leading-relaxed">{analysis.overview}</p>
        )}

        {conclusion?.probability && (
          <div>
            <span className="text-xs text-muted-foreground">成功率</span>
            <p className="font-medium">{conclusion.probability}</p>
          </div>
        )}

        {conclusion?.opportunities?.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">机会点</span>
            <p className="mt-0.5 text-muted-foreground">{conclusion.opportunities.join("；")}</p>
          </div>
        )}

        {conclusion?.obstacles?.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">潜在障碍</span>
            <p className="mt-0.5 text-muted-foreground">{conclusion.obstacles.join("；")}</p>
          </div>
        )}

        {advice?.strategy?.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">建议</span>
            <p className="mt-0.5 text-muted-foreground">{advice.strategy.join("；")}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 入口按钮：紧凑 tab 栏 */}
      <div className="flex gap-1 rounded-lg border border-primary/10 bg-muted/30 p-1">
        {ANALYSIS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleAnalyze(opt.id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors ${
              activeType === opt.id
                ? "bg-card font-medium text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-base">{opt.icon}</span>
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* 事项分析输入表单 */}
      {activeType === "affair" && !result && !error && (
        <Card className="border-primary/10">
          <CardContent className="flex flex-col gap-3 p-3">
            <div className="flex gap-2">
              <Select value={selectedAffair} onValueChange={setSelectedAffair}>
                <SelectTrigger className="h-8 flex-1 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AFFAIR_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="text"
                value={affairInput}
                onChange={(e) => setAffairInput(e.target.value)}
                placeholder="具体描述，如：投资股票"
                className="h-8 flex-1 rounded-md border px-2 text-sm"
              />
            </div>
            <Button
              onClick={() => handleAnalyze("affair")}
              size="sm"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />分析中...</>
              ) : (
                <><Sparkles className="mr-1.5 h-3.5 w-3.5" />开始分析</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 错误 */}
      {error && (
        <div className="rounded-md bg-destructive/5 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在分析中...
        </div>
      )}

      {/* 结果 */}
      {result && !loading && (
        <div className="rounded-lg border border-primary/10 bg-card p-3">
          {activeType === "patterns" && renderPatterns(result)}
          {activeType === "all-palaces" && renderPalaces(result)}
          {activeType === "personality" && renderPersonality(result)}
          {activeType === "affair" && renderAffair(result)}
        </div>
      )}
    </div>
  );
}
