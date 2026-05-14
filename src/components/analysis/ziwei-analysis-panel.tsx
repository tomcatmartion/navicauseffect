"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  | "patterns"
  /** 原「计算调试」子项，与宫位能级等同级入口 */
  | "debug-sihua"
  | "debug-merged-sihua"
  | "debug-three-layer"
  | "debug-taisui-rua"
  | "debug-liunian"
  | "debug-prompts";

function isDebugTab(type: AnalysisType | null): type is Exclude<
  AnalysisType,
  | "palace"
  | "all-palaces"
  | "personality"
  | "interaction"
  | "affair"
  | "full"
  | "patterns"
> {
  if (!type) return false;
  return (
    type === "debug-sihua" ||
    type === "debug-merged-sihua" ||
    type === "debug-three-layer" ||
    type === "debug-taisui-rua" ||
    type === "debug-liunian" ||
    type === "debug-prompts"
  );
}

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
  /** 与 Hybrid 一致的 iztro 序列化命盘；有则四项分析走 Stage1–4，否则回退旧 /api/ziwei/analyze */
  chartData?: Record<string, unknown> | null;
}

const ANALYSIS_OPTIONS = [
  { id: "patterns" as const, label: "格局识别", icon: "🏆" },
  { id: "all-palaces" as const, label: "宫位能级", icon: "📊" },
  { id: "personality" as const, label: "性格分析", icon: "🔮" },
  { id: "debug-sihua" as const, label: "生年·太岁四化", icon: "🔣" },
  { id: "debug-merged-sihua" as const, label: "合并四化", icon: "🔗" },
  { id: "debug-three-layer" as const, label: "三层表", icon: "📐" },
  { id: "debug-taisui-rua" as const, label: "太岁入卦", icon: "🎴" },
  { id: "debug-liunian" as const, label: "流年", icon: "📅" },
  { id: "debug-prompts" as const, label: "阶段 Prompt", icon: "📝" },
  { id: "affair" as const, label: "事项分析", icon: "🎯" },
] as const;

/** POST /api/ziwei/chart-pipeline-debug 返回 data 形状（精简，仅前端消费） */
interface PipelineSnapshot {
  engine: string;
  patterns: Array<{
    name: string;
    category: string;
    effect: string;
    source: string;
    description: string;
  }>;
  dslPatternHits: Array<{ id: string; name: string }>;
  allPalaces: Record<string, { palace: string; diZhi: string; level: string; finalScore: number }>;
  personality: {
    overview: string;
    traits: { surface: string[]; core: string[] };
    strengths: string[];
    weaknesses: string[];
    advice: { overall: string };
  };
  affair: {
    overview: string;
    conclusion: { probability: string; opportunities: string[]; obstacles: string[] };
    advice: { strategy: string[] };
  };
  extended: {
    birthGan: string;
    taiSuiZhi: string;
    dunGanStem: string;
    shengNianSihua: Record<string, string>;
    taiSuiPalaceStemSihua: Record<string, string>;
    dunGanNote: string;
    mergedSihuaEntries: Array<{ type: string; star: string; source: string }>;
    specialOverlaps: Array<{ type: string; star: string }>;
    threeLayerTable: unknown;
    taiSuiRua: {
      mode: string;
      partnerYear: number | null;
      virtualChart: unknown;
      tensionPoints: string[];
    };
    prompts: { stage1: string; stage2: string; stage3: string; stage4: string };
  };
}

/** 格局列表项（管线与旧 analyze 返回兼容） */
interface PatternListItem {
  name: string;
  category?: string;
  effect: string;
  source: string;
  description?: string;
}

interface PalaceCell {
  palace: string;
  diZhi: string;
  level: string;
  finalScore: number;
}

interface KnowledgeSnippet {
  source: string;
  key: string;
  content: string;
}

interface PersonalityVm {
  overview?: string;
  traits?: { surface: string[]; middle?: string[]; core: string[] };
  fourDimensions?: {
    self: string;
    opposite: string;
    trine: string;
    flanking: string;
    synthesis: string;
  };
  strengths?: string[];
  weaknesses?: string[];
  advice?: { overall?: string; career?: string; relationship?: string; health?: string };
  patternInfluences?: string[];
  holographicBase?: {
    sihuaDirection?: string;
    auspiciousEffect?: string;
    inauspiciousEffect?: string;
    minorEffect?: string;
    summary?: string;
  };
  knowledgeSnippets?: KnowledgeSnippet[];
}

interface AffairVm {
  overview?: string;
  conclusion?: {
    probability?: string;
    opportunities?: string[];
    obstacles?: string[];
  };
  advice?: { strategy?: string[] };
}

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

export function ZiweiAnalysisPanel({ birthData, currentAge, chartData }: ZiweiAnalysisPanelProps) {
  const [activeType, setActiveType] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(false);
  const [legacyResult, setLegacyResult] = useState<unknown>(null);
  const [pipelineSnapshot, setPipelineSnapshot] = useState<PipelineSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAffair, setSelectedAffair] = useState("求财");
  const [affairInput, setAffairInput] = useState("投资赚钱");
  const [targetYear, setTargetYear] = useState(() => new Date().getFullYear());
  const [partnerDebugYear, setPartnerDebugYear] = useState("");

  const usePipeline = Boolean(chartData?.palaces);

  const fetchPipelineSnapshot = useCallback(
    async (opts?: {
      affairType?: string;
      affair?: string;
      targetYear?: number;
      partnerBirthYear?: number | null;
    }) => {
      if (!chartData) return null;
      const raw = opts?.partnerBirthYear;
      const partner =
        raw === undefined
          ? partnerDebugYear.trim() === ""
            ? null
            : Number.parseInt(partnerDebugYear, 10)
          : raw;
      const partnerNorm =
        partner !== null && (Number.isNaN(partner) || partner < 1900 || partner > 2100) ? null : partner;

      const res = await fetch("/api/ziwei/chart-pipeline-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chartData,
          affairType: opts?.affairType ?? selectedAffair,
          affair: opts?.affair ?? affairInput,
          targetYear: opts?.targetYear ?? targetYear,
          partnerBirthYear: partnerNorm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "调试接口失败");
      return json.data as PipelineSnapshot;
    },
    [chartData, selectedAffair, affairInput, targetYear, partnerDebugYear],
  );

  const fetchLegacyAnalyze = async (type: AnalysisType) => {
    const payload: Record<string, unknown> = {
      type,
      birthData,
      currentAge,
    };
    if (type === "affair") {
      payload.affair = affairInput;
      payload.affairType = selectedAffair;
      payload.targetYear = { year: targetYear };
    }
    const response = await fetch("/api/ziwei/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "分析失败");
    return data.data;
  };

  const handleAnalyze = async (type: AnalysisType) => {
    if (activeType === type && (pipelineSnapshot || legacyResult)) {
      setActiveType(null);
      return;
    }
    setActiveType(type);
    setLoading(true);
    setError(null);
    setLegacyResult(null);

    try {
      if (usePipeline && type === "affair") {
        setLoading(false);
        return;
      }
      if (usePipeline && (type === "patterns" || type === "all-palaces" || type === "personality")) {
        const snap = await fetchPipelineSnapshot({
          affairType: selectedAffair,
          affair: affairInput,
          targetYear,
        });
        setPipelineSnapshot(snap);
        return;
      }
      if (usePipeline && isDebugTab(type)) {
        if (pipelineSnapshot) {
          return;
        }
        const snap = await fetchPipelineSnapshot({
          affairType: selectedAffair,
          affair: affairInput,
          targetYear,
        });
        setPipelineSnapshot(snap);
        return;
      }
      if (!usePipeline && isDebugTab(type)) {
        setPipelineSnapshot(null);
        setError("调试项需已排盘并携带命盘数据（chartData）。");
        return;
      }
      setPipelineSnapshot(null);
      const data = await fetchLegacyAnalyze(type);
      setLegacyResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  /** 按当前表单（对方生年、流年等）重新拉管线快照 */
  const refreshPipelineDebug = async () => {
    if (!usePipeline) return;
    setLoading(true);
    setError(null);
    try {
      const py =
        partnerDebugYear.trim() === "" ? null : Number.parseInt(partnerDebugYear, 10);
      const partnerNorm =
        py !== null && (Number.isNaN(py) || py < 1900 || py > 2100) ? null : py;
      const snap = await fetchPipelineSnapshot({
        affairType: selectedAffair,
        affair: affairInput,
        targetYear,
        partnerBirthYear: partnerNorm,
      });
      setPipelineSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  };

  const runAffairPipeline = async () => {
    if (!usePipeline) {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLegacyAnalyze("affair");
        setLegacyResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "请求失败");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snap = await fetchPipelineSnapshot({
        affairType: selectedAffair,
        affair: affairInput,
        targetYear,
      });
      setPipelineSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const displayResult: unknown = pipelineSnapshot || legacyResult;

  const legacyPatterns = (): PatternListItem[] =>
    Array.isArray(legacyResult) ? (legacyResult as PatternListItem[]) : [];
  const legacyPalaces = (): Record<string, PalaceCell> =>
    legacyResult && typeof legacyResult === "object" && !Array.isArray(legacyResult)
      ? (legacyResult as Record<string, PalaceCell>)
      : {};
  const legacyPersonality = (): PersonalityVm =>
    (legacyResult && typeof legacyResult === "object" && !Array.isArray(legacyResult)
      ? (legacyResult as PersonalityVm)
      : {}) as PersonalityVm;
  const legacyAffair = (): AffairVm =>
    (legacyResult && typeof legacyResult === "object" && !Array.isArray(legacyResult)
      ? (legacyResult as AffairVm)
      : {}) as AffairVm;

  // ─── 格局识别：紧凑列表 ───
  const renderPatterns = (patterns: PatternListItem[], dslHits?: Array<{ id: string; name: string }>) => {
    if (!patterns || patterns.length === 0) {
      return <p className="py-2 text-sm text-muted-foreground">未识别到特殊格局</p>;
    }

    const grouped = patterns.reduce(
      (acc: Record<string, PatternListItem[]>, p: PatternListItem) => {
        const group = p.category || "其他";
        if (!acc[group]) acc[group] = [];
        acc[group].push(p);
        return acc;
      },
      {} as Record<string, PatternListItem[]>,
    );

    return (
      <div className="space-y-3">
        {dslHits && dslHits.length > 0 && (
          <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-2 py-1.5 text-[11px] text-muted-foreground">
            patterns.json（DSL 引擎）：{dslHits.map((d) => d.name).join("、")}
          </div>
        )}
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{category}格局</div>
            <div className="space-y-1">
              {items.map((p, i: number) => {
                const effect = p.effect;
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
  const renderPalaces = (assessments: Record<string, PalaceCell>) => {
    const entries = Object.entries(assessments);
    return (
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-primary/10 bg-primary/5">
        {entries.map(([branch, data]) => {
          const score = data.finalScore;
          return (
            <div
              key={branch}
              className="flex items-center justify-between bg-card px-2.5 py-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium">{data.palace}</span>
                <span className="ml-1 text-xs text-muted-foreground">{branch}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{data.level}</span>
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
  const renderPersonality = (profile: PersonalityVm) => {
    return (
      <div className="space-y-4 text-sm">
        {profile.overview && (
          <div className="border-b border-primary/10 pb-3">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{profile.overview}</p>
          </div>
        )}

        {profile.traits && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">性格特质分层</div>
            <div className="grid grid-cols-3 gap-2">
              {profile.traits.surface?.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-2">
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-1">表层 · 早年凸显</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.traits.surface.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 bg-blue-100 dark:bg-blue-900/40">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.traits.middle && profile.traits.middle.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded p-2">
                  <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">中层 · 大限后渐显</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.traits.middle.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 bg-purple-100 dark:bg-purple-900/40">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.traits.core?.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/20 rounded p-2">
                  <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium mb-1">核心 · 关键时刻爆发</div>
                  <div className="flex flex-wrap gap-1">
                    {profile.traits.core.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 bg-orange-100 dark:bg-orange-900/40">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {profile.fourDimensions && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">四维合参</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">本宫：</span>
                <span className="text-foreground">{profile.fourDimensions.self || '—'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">对宫：</span>
                <span className="text-foreground">{profile.fourDimensions.opposite || '—'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">三合：</span>
                <span className="text-foreground">{profile.fourDimensions.trine || '—'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground shrink-0">夹宫：</span>
                <span className="text-foreground">{profile.fourDimensions.flanking || '—'}</span>
              </div>
            </div>
            {profile.fourDimensions.synthesis && (
              <div className="text-[11px] text-muted-foreground bg-muted/50 rounded p-2 mt-1">
                综合：{profile.fourDimensions.synthesis}
              </div>
            )}
          </div>
        )}

        {profile.holographicBase && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium">命宫全息底色</div>
            <div className="space-y-1 text-[11px]">
              {profile.holographicBase.sihuaDirection && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0">四化方向：</span>
                  <span className="text-foreground">{profile.holographicBase.sihuaDirection}</span>
                </div>
              )}
              {profile.holographicBase.auspiciousEffect && (
                <div className="flex items-start gap-2">
                  <span className="text-green-600 shrink-0">吉星影响：</span>
                  <span className="text-foreground">{profile.holographicBase.auspiciousEffect}</span>
                </div>
              )}
              {profile.holographicBase.inauspiciousEffect && (
                <div className="flex items-start gap-2">
                  <span className="text-red-600 shrink-0">煞星影响：</span>
                  <span className="text-foreground">{profile.holographicBase.inauspiciousEffect}</span>
                </div>
              )}
              {profile.holographicBase.summary && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0">综合底色：</span>
                  <span className="text-foreground font-medium">{profile.holographicBase.summary}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {profile.patternInfluences && profile.patternInfluences.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">格局影响</div>
            <div className="space-y-1">
              {profile.patternInfluences.map((p: string, i: number) => (
                <div key={i} className="text-[11px] text-foreground flex items-start gap-1">
                  <span>•</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.strengths && profile.strengths.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
              <span>💪</span> 优势
            </div>
            <div className="space-y-1">
              {profile.strengths.map((s: string, i: number) => (
                <div key={i} className="text-[11px] text-foreground flex items-start gap-1">
                  <span className="text-green-500">✅</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.weaknesses && profile.weaknesses.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
              <span>⚠️</span> 挑战
            </div>
            <div className="space-y-1">
              {profile.weaknesses.map((w: string, i: number) => (
                <div key={i} className="text-[11px] text-foreground flex items-start gap-1">
                  <span className="text-orange-500">❌</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.advice && (
          <div className="space-y-2 border-t border-primary/10 pt-3">
            <div className="text-xs text-muted-foreground font-medium">💡 发展建议</div>
            <div className="space-y-2 text-[11px]">
              {profile.advice.overall && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
                  <div className="text-blue-600 dark:text-blue-400 font-medium mb-1">📋 总体分析</div>
                  <div className="text-foreground leading-relaxed">{profile.advice.overall}</div>
                </div>
              )}
              {profile.advice.career && (
                <div className="flex items-start gap-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-2">
                  <span className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">💼</span>
                  <div>
                    <div className="text-blue-600 dark:text-blue-400 text-[10px] font-medium">事业发展</div>
                    <div className="text-foreground">{profile.advice.career}</div>
                  </div>
                </div>
              )}
              {profile.advice.relationship && (
                <div className="flex items-start gap-2 bg-pink-50/50 dark:bg-pink-950/20 rounded-lg p-2">
                  <span className="text-pink-600 dark:text-pink-400 shrink-0 mt-0.5">💕</span>
                  <div>
                    <div className="text-pink-600 dark:text-pink-400 text-[10px] font-medium">感情相处</div>
                    <div className="text-foreground">{profile.advice.relationship}</div>
                  </div>
                </div>
              )}
              {profile.advice.health && (
                <div className="flex items-start gap-2 bg-green-50/50 dark:bg-green-950/20 rounded-lg p-2">
                  <span className="text-green-600 dark:text-green-400 shrink-0 mt-0.5">🌿</span>
                  <div>
                    <div className="text-green-600 dark:text-green-400 text-[10px] font-medium">健康养生</div>
                    <div className="text-foreground">{profile.advice.health}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {profile.knowledgeSnippets && profile.knowledgeSnippets.length > 0 && (
          <div className="space-y-3 border-t border-primary/10 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">📚</span>
              <span className="text-xs text-muted-foreground font-medium">命主性格知识库解读</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                {profile.knowledgeSnippets.length} 条
              </Badge>
            </div>

            <div className="space-y-2">
              {profile.knowledgeSnippets.map((snippet, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 rounded-lg p-3 border border-slate-200/50 dark:border-slate-700/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold shadow-sm">
                      {idx + 1}
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    >
                      {snippet.source}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">/</span>
                    <span className="text-[10px] font-medium text-foreground">{snippet.key}</span>
                  </div>
                  <div className="text-[11px] text-foreground leading-relaxed pl-7">
                    {snippet.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── 事项分析：紧凑展示 ───
  const renderAffair = (analysis: AffairVm) => {
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

        {conclusion?.opportunities && conclusion.opportunities.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">机会点</span>
            <p className="mt-0.5 text-muted-foreground">{conclusion.opportunities.join("；")}</p>
          </div>
        )}

        {conclusion?.obstacles && conclusion.obstacles.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">潜在障碍</span>
            <p className="mt-0.5 text-muted-foreground">{conclusion.obstacles.join("；")}</p>
          </div>
        )}

        {advice?.strategy && advice.strategy.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">建议</span>
            <p className="mt-0.5 text-muted-foreground">{advice.strategy.join("；")}</p>
          </div>
        )}
      </div>
    );
  };

  const promptDebugEntries: Array<{ key: keyof PipelineSnapshot["extended"]["prompts"]; title: string }> = [
    { key: "stage1", title: "阶段一（宫位评分）" },
    { key: "stage2", title: "阶段二（性格定性）" },
    { key: "stage3", title: "阶段三（事项分析）" },
    { key: "stage4", title: "阶段四（互动 / 单方）" },
  ];

  const renderDebugPipelineHeader = (snap: PipelineSnapshot) => {
    const ex = snap.extended;
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-primary/10 pb-2">
        <Badge variant="outline" className="text-[10px]">
          Hybrid Stage 管线
        </Badge>
        <Badge variant="secondary">引擎：{snap.engine}</Badge>
        <span className="text-xs text-muted-foreground">
          生年干 {ex.birthGan} · 太岁宫支 {ex.taiSuiZhi} · 五虎遁宫干 {ex.dunGanStem}
        </span>
      </div>
    );
  };

  const renderDebugSihua = (snap: PipelineSnapshot) => {
    const ex = snap.extended;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-[11px] text-muted-foreground leading-snug">{ex.dunGanNote}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <pre className="overflow-x-auto rounded border border-primary/15 bg-muted/20 p-2 text-[11px]">
            {JSON.stringify(ex.shengNianSihua, null, 2)}
          </pre>
          <pre className="overflow-x-auto rounded border border-primary/15 bg-muted/20 p-2 text-[11px]">
            {JSON.stringify(ex.taiSuiPalaceStemSihua, null, 2)}
          </pre>
        </div>
      </div>
    );
  };

  const renderDebugMergedSihua = (snap: PipelineSnapshot) => {
    const ex = snap.extended;
    return (
      <div className="space-y-3 text-sm">
        <pre className="max-h-40 overflow-auto rounded border border-primary/15 bg-muted/20 p-2 text-[11px]">
          {JSON.stringify(ex.mergedSihuaEntries, null, 2)}
        </pre>
        {ex.specialOverlaps.length > 0 && (
          <pre className="max-h-32 overflow-auto rounded border border-primary/15 bg-muted/20 p-2 text-[11px]">
            {JSON.stringify(ex.specialOverlaps, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  const renderDebugThreeLayer = (snap: PipelineSnapshot) => (
    <pre className="max-h-[min(480px,55vh)] overflow-auto rounded border border-primary/15 bg-muted/20 p-2 text-[10px] leading-relaxed">
      {JSON.stringify(snap.extended.threeLayerTable, null, 2)}
    </pre>
  );

  const renderDebugTaisuiRua = (snap: PipelineSnapshot) => {
    const ex = snap.extended;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          太岁入卦（{ex.taiSuiRua.mode === "full" ? "有对方生年" : "单方 / 无对方年"}）
        </p>
        {ex.taiSuiRua.tensionPoints.length > 0 && (
          <ul className="list-inside list-disc text-[11px] text-muted-foreground">
            {ex.taiSuiRua.tensionPoints.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
        <pre className="max-h-[min(360px,45vh)] overflow-auto rounded border border-primary/15 bg-muted/20 p-2 text-[10px]">
          {JSON.stringify(ex.taiSuiRua.virtualChart, null, 2)}
        </pre>
        <div className="rounded-md border border-primary/15 bg-muted/20 p-2">
          <div className="text-xs font-medium">刷新入卦（对方生年）</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="number"
              placeholder="如 1990"
              value={partnerDebugYear}
              onChange={(e) => setPartnerDebugYear(e.target.value)}
              className="h-8 w-28 rounded-md border px-2 text-sm"
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => void refreshPipelineDebug()} disabled={loading}>
              应用并刷新
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderDebugLiunian = () => (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        流年参与 Stage3 等事项矩阵；修改后点击下方按钮重新请求管线。
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <div className="mb-1 text-xs font-medium">目标流年</div>
          <input
            type="number"
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value) || new Date().getFullYear())}
            className="h-8 w-28 rounded-md border px-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => void refreshPipelineDebug()} disabled={loading}>
          按流年重算
        </Button>
      </div>
    </div>
  );

  const renderDebugPrompts = (snap: PipelineSnapshot) => {
    const ex = snap.extended;
    return (
      <div className="space-y-2">
        {promptDebugEntries.map(({ key, title }) => (
          <div key={key}>
            <div className="text-[11px] font-medium text-primary/80">{title}</div>
            <ScrollArea className="mt-1 h-[min(220px,40vh)] w-full rounded border bg-card p-2">
              <pre className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground">
                {ex.prompts[key]}
              </pre>
            </ScrollArea>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* 入口按钮：紧凑 tab 栏 */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-primary/10 bg-muted/30 p-1">
        {ANALYSIS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleAnalyze(opt.id)}
            className={`flex min-w-[4.5rem] flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-sm transition-colors sm:min-w-0 ${
              activeType === opt.id
                ? "bg-card font-medium text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-base">{opt.icon}</span>
            <span className="max-w-[4.5rem] truncate sm:max-w-none">{opt.label}</span>
          </button>
        ))}
      </div>

      {usePipeline && (
        <p className="text-[11px] text-muted-foreground">
          格局、宫位、性格、事项与 Hybrid 共用 Stage1–4；「生年·太岁四化」等为原计算调试子项，与宫位能级同级切换；无 chartData
          时回退旧引擎。
        </p>
      )}

      {/* 事项分析：参数 + 计算（管线版需点「开始分析」） */}
      {activeType === "affair" && (
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
            <Button onClick={() => void runAffairPipeline()} size="sm" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {usePipeline ? "按上述参数计算（Stage3）" : "开始分析"}
                </>
              )}
            </Button>
            {usePipeline && pipelineSnapshot && !loading && (
              <div className="rounded-md border border-dashed border-primary/20 bg-muted/30 p-2">
                {renderAffair(pipelineSnapshot.affair)}
              </div>
            )}
            {!usePipeline && !!legacyResult && !loading && (
              <div className="rounded-md border border-dashed border-primary/20 bg-muted/30 p-2">
                {renderAffair(legacyAffair())}
              </div>
            )}
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

      {/* 结果：格局 / 宫位 / 性格 / 各调试子项 共用卡片；事项单独卡片 */}
      {!!displayResult && !loading && activeType !== "affair" && (
        <div className="rounded-lg border border-primary/10 bg-card p-3">
          {pipelineSnapshot && activeType && !isDebugTab(activeType) && (
            <Badge variant="outline" className="mb-2 text-[10px]">
              Hybrid Stage 管线
            </Badge>
          )}
          {activeType === "patterns" &&
            (pipelineSnapshot
              ? renderPatterns(pipelineSnapshot.patterns, pipelineSnapshot.dslPatternHits)
              : renderPatterns(legacyPatterns()))}
          {activeType === "all-palaces" &&
            (pipelineSnapshot ? renderPalaces(pipelineSnapshot.allPalaces) : renderPalaces(legacyPalaces()))}
          {activeType === "personality" &&
            (pipelineSnapshot
              ? renderPersonality(pipelineSnapshot.personality)
              : renderPersonality(legacyPersonality()))}
          {activeType === "debug-sihua" && pipelineSnapshot && (
            <>
              {renderDebugPipelineHeader(pipelineSnapshot)}
              {renderDebugSihua(pipelineSnapshot)}
            </>
          )}
          {activeType === "debug-merged-sihua" && pipelineSnapshot && (
            <>
              {renderDebugPipelineHeader(pipelineSnapshot)}
              {renderDebugMergedSihua(pipelineSnapshot)}
            </>
          )}
          {activeType === "debug-three-layer" && pipelineSnapshot && (
            <>
              {renderDebugPipelineHeader(pipelineSnapshot)}
              {renderDebugThreeLayer(pipelineSnapshot)}
            </>
          )}
          {activeType === "debug-taisui-rua" && pipelineSnapshot && (
            <>
              {renderDebugPipelineHeader(pipelineSnapshot)}
              {renderDebugTaisuiRua(pipelineSnapshot)}
            </>
          )}
          {activeType === "debug-liunian" && pipelineSnapshot && (
            <>
              {renderDebugPipelineHeader(pipelineSnapshot)}
              {renderDebugLiunian()}
            </>
          )}
          {activeType === "debug-prompts" && pipelineSnapshot && (
            <>
              {renderDebugPipelineHeader(pipelineSnapshot)}
              {renderDebugPrompts(pipelineSnapshot)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
