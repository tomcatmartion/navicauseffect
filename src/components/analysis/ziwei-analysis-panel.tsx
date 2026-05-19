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
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

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
    level?: string;
    /** 调试：格局判定详情 */
    debug?: {
      requiredStars: string[];
      starPalaces: Record<string, string>;
      judgmentBasis: string;
      multiplierSource: string;
      multiplierValue: number;
      triggerCondition: string;
    };
  }>;
  dslPatternHits: Array<{ id: string; name: string }>;
  allPalaces: Record<string, {
    palace: string;
    diZhi: string;
    level: string;
    finalScore: number;
    /** 调试：宫位计算详情 */
    debug?: {
      skeletonScore: number;
      skeletonSource: string;
      ceiling: number;
      bonusTotal: number;
      bonusBreakdown: Array<{ source: string; value: number; detail: string }>;
      penaltyTotal: number;
      penaltyBreakdown: Array<{ source: string; value: number; detail: string }>;
      luCunDelta: number;
      patternMultiplier: number;
      patternMultiplierSource: string;
      isAbsoluteFail: boolean;
      criticalStatus: string;
      subdueLevel: string;
      majorStars: Array<{ star: string; brightness: string }>;
      allStars: Array<{ name: string; sihua?: string; sihuaSource?: string }>;
      formula: string;
      relatedPalaces: Array<{ palace: string; diZhi: string; role: string }>;
      /** 六步评分流程（基于 scoring_formula.json v2.3） */
      sixSteps?: {
        step0_emptyBorrow?: {
          isEmpty: boolean;
          borrowedFrom?: string;
          borrowDepth?: number;
          borrowFactor?: number;
        };
        step1_skeleton: {
          baseScore: number;
          ceiling: number;
          brightness: string;
        };
        step2_bonus: {
          scoreAfterBonus: number;
          details: {
            '2.1_三方四正吉星': number;
            '2.2_命主生年化禄': number;
            '2.3_命主遁干化禄': number;
            '2.4_父亲生年化禄': number;
            '2.5_父亲遁干化禄': number;
            '2.6_母亲生年化禄': number;
            '2.7_母亲遁干化禄': number;
            '2.8_吉格倍率': number;
          };
        };
        step3_warmCool: {
          label: string;
        };
        step4_penalty: {
          scoreAfterPenalty: number;
          details: {
            '4.1_三方四正煞星': number;
            '4.2_命主生年化忌': number;
            '4.3_命主遁干化忌': number;
            '4.4_父亲生年化忌': number;
            '4.5_父亲遁干化忌': number;
            '4.6_母亲生年化忌': number;
            '4.7_母亲遁干化忌': number;
            '4.8_凶格倍率': number;
          };
          intensityFactor: number;
        };
        step5_luCun: {
          scoreAfterLuCun: number;
          delta: number;
        };
        step6_ceiling: {
          finalScore: number;
          isAbsoluteFail: boolean;
          specialFlags: string[];
        };
      };
    };
  }>;
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

/** 调试展开状态管理 */
interface DebugExpandedState {
  patterns: Record<string, boolean>;
  palaces: Record<string, boolean>;
}

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
  const [debugExpanded, setDebugExpanded] = useState<DebugExpandedState>({
    patterns: {},
    palaces: {},
  });

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

  const displayResult = Boolean(pipelineSnapshot || legacyResult);

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

  // ─── 格局识别：紧凑列表（含调试详情） ───
  const renderPatterns = (patterns: PatternListItem[], dslHits?: Array<{ id: string; name: string }>, fromPipeline?: boolean) => {
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

    const togglePatternDebug = (name: string) => {
      setDebugExpanded(prev => ({
        ...prev,
        patterns: { ...prev.patterns, [name]: !prev.patterns[name] },
      }));
    };

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
                const isExpanded = debugExpanded.patterns[p.name];
                // 从 pipeline snapshot 获取原始数据以读取 debug 字段
                const rawPattern = fromPipeline
                  ? pipelineSnapshot?.patterns.find(pp => pp.name === p.name)
                  : null;
                const debug = rawPattern?.debug;

                return (
                  <div key={i} className="rounded border-l-[3px] border-l-current overflow-hidden"
                    style={{ borderLeftColor: effect === "positive" ? "#10b981" : effect === "negative" ? "#f43f5e" : "#f59e0b" }}
                  >
                    <div className="flex items-center gap-2 py-1.5 pl-2 pr-1 text-sm cursor-pointer hover:bg-muted/30"
                      onClick={() => fromPipeline && togglePatternDebug(p.name)}
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
                      {fromPipeline && (
                        <span className="ml-auto shrink-0">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </span>
                      )}
                    </div>

                    {/* 调试详情展开区 */}
                    {fromPipeline && isExpanded && debug && (
                      <div className="px-2 pb-2 pt-1 bg-muted/20 text-[11px] space-y-1.5 border-t border-dashed border-primary/10">
                        {/* 星曜组合与宫位 */}
                        <div>
                          <span className="font-medium text-primary/80">成格星曜：</span>
                          <span className="text-muted-foreground">
                            {debug.requiredStars.join('、')}
                          </span>
                        </div>
                        {Object.keys(debug.starPalaces).length > 0 && (
                          <div>
                            <span className="font-medium text-primary/80">星曜落宫：</span>
                            <span className="text-muted-foreground">
                              {Object.entries(debug.starPalaces).map(([star, zhi]) => `${star}在${zhi}宫`).join('；')}
                            </span>
                          </div>
                        )}
                        {/* 吉凶依据 */}
                        <div>
                          <span className="font-medium text-primary/80">吉凶依据：</span>
                          <span className="text-muted-foreground">{debug.judgmentBasis}</span>
                        </div>
                        {/* 倍率来源 */}
                        <div>
                          <span className="font-medium text-primary/80">倍率来源：</span>
                          <span className="text-muted-foreground">{debug.multiplierSource}</span>
                        </div>
                        {/* 引动条件 */}
                        <div>
                          <span className="font-medium text-primary/80">引动条件：</span>
                          <span className="text-muted-foreground">{debug.triggerCondition}</span>
                        </div>
                      </div>
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

  // ─── 宫位能级：紧凑网格（含点击展开调试详情） ───
  const renderPalaces = (assessments: Record<string, PalaceCell>, fromPipeline?: boolean) => {
    const entries = Object.entries(assessments);

    const togglePalaceDebug = (diZhi: string) => {
      setDebugExpanded(prev => ({
        ...prev,
        palaces: { ...prev.palaces, [diZhi]: !prev.palaces[diZhi] },
      }));
    };

    return (
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-primary/10 bg-primary/5">
        {entries.map(([branch, data]) => {
          const score = data.finalScore;
          const isExpanded = debugExpanded.palaces[branch];
          // 从 pipeline snapshot 获取原始数据以读取 debug 字段
          const rawPalace = fromPipeline
            ? pipelineSnapshot?.allPalaces[branch]
            : null;
          const debug = rawPalace?.debug;

          return (
            <div
              key={branch}
              className={`bg-card px-2.5 py-2 ${fromPipeline ? 'cursor-pointer hover:bg-muted/30' : ''}`}
              onClick={() => fromPipeline && togglePalaceDebug(branch)}
            >
              <div className="flex items-center justify-between">
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
                  {fromPipeline && (
                    <span className="shrink-0">
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </span>
                  )}
                </div>
              </div>

              {/* 调试详情展开区 */}
              {fromPipeline && isExpanded && debug && (
                <div className="mt-2 pt-2 border-t border-dashed border-primary/10 text-[11px] space-y-1.5">
                  {/* 六步评分流程（基于 scoring_formula.json v1.3） */}
                  {debug.sixSteps && (
                    <div className="space-y-1">
                      <div className="font-medium text-primary/80 text-[10px] mb-1">六步评分流程</div>

                      {/* 步骤0：空宫借对宫 */}
                      {debug.sixSteps.step0_emptyBorrow?.isEmpty && (
                        <div className="bg-orange-50/50 dark:bg-orange-950/10 rounded p-1">
                          <span className="font-medium text-orange-700">步骤0 空宫借对宫：</span>
                          <span className="text-muted-foreground">借{debug.sixSteps.step0_emptyBorrow.borrowedFrom} × {debug.sixSteps.step0_emptyBorrow.borrowFactor}</span>
                        </div>
                      )}

                      {/* 步骤1：初始基础分 */}
                      <div className="flex justify-between items-center">
                        <span className="text-primary/70">步骤1 骨架基础分：</span>
                        <span>{debug.sixSteps.step1_skeleton.baseScore.toFixed(1)}（天花板 {debug.sixSteps.step1_skeleton.ceiling.toFixed(1)}）</span>
                      </div>

                      {/* 步骤2：加分阶段 */}
                      <div className="bg-green-50/30 dark:bg-green-950/10 rounded p-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-medium text-green-700">步骤2 加分阶段</span>
                          <span>加分后：{debug.sixSteps.step2_bonus.scoreAfterBonus.toFixed(2)}</span>
                        </div>
                        <div className="space-y-0.5 pl-2">
                          <div className="flex justify-between"><span>2.1 三方四正吉星：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.1_三方四正吉星'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.2 命主生年化禄：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.2_命主生年化禄'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.3 命主遁干化禄：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.3_命主遁干化禄'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.4 父亲生年化禄：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.4_父亲生年化禄'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.5 父亲遁干化禄：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.5_父亲遁干化禄'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.6 母亲生年化禄：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.6_母亲生年化禄'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.7 母亲遁干化禄：</span><span className="text-green-600">+{debug.sixSteps.step2_bonus.details['2.7_母亲遁干化禄'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>2.8 吉格倍率：</span><span className="text-green-600">×{debug.sixSteps.step2_bonus.details['2.8_吉格倍率'].toFixed(1)}</span></div>
                        </div>
                      </div>

                      {/* 步骤3：重新定性 */}
                      <div className="flex justify-between items-center">
                        <span className="text-primary/70">步骤3 旺弱定性：</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{debug.sixSteps.step3_warmCool.label}</Badge>
                      </div>

                      {/* 步骤4：减分阶段 */}
                      <div className="bg-red-50/30 dark:bg-red-950/10 rounded p-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-medium text-red-700">步骤4 减分阶段</span>
                          <span>减分后：{debug.sixSteps.step4_penalty.scoreAfterPenalty.toFixed(2)}</span>
                        </div>
                        <div className="space-y-0.5 pl-2">
                          <div className="flex justify-between"><span>4.1 三方四正煞星：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.1_三方四正煞星'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.2 命主生年化忌：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.2_命主生年化忌'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.3 命主遁干化忌：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.3_命主遁干化忌'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.4 父亲生年化忌：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.4_父亲生年化忌'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.5 父亲遁干化忌：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.5_父亲遁干化忌'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.6 母亲生年化忌：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.6_母亲生年化忌'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.7 母亲遁干化忌：</span><span className="text-red-600">{debug.sixSteps.step4_penalty.details['4.7_母亲遁干化忌'].toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>4.8 凶格倍率：</span><span className="text-red-600">×{debug.sixSteps.step4_penalty.details['4.8_凶格倍率'].toFixed(1)}</span></div>
                          <div className="flex justify-between text-[10px] text-muted-foreground"><span>intensity_factor：</span><span>{debug.sixSteps.step4_penalty.intensityFactor}</span></div>
                        </div>
                      </div>

                      {/* 步骤5：禄存调整 */}
                      <div className="flex justify-between items-center">
                        <span className="text-primary/70">步骤5 禄存调整：</span>
                        <span>{debug.sixSteps.step5_luCun.delta >= 0 ? '+' : ''}{debug.sixSteps.step5_luCun.delta.toFixed(1)} → {debug.sixSteps.step5_luCun.scoreAfterLuCun.toFixed(2)}</span>
                      </div>

                      {/* 步骤6：天花板截断 */}
                      <div className="flex justify-between items-center">
                        <span className="text-primary/70">步骤6 天花板截断：</span>
                        <span>{debug.sixSteps.step6_ceiling.finalScore.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* 原有调试信息保留 */}
                  <div className="border-t border-dashed border-primary/10 pt-1.5">
                    {/* 计算公式 */}
                    <div className="bg-muted/30 rounded p-1.5 font-mono text-[10px] text-muted-foreground">
                      {debug.formula}
                    </div>

                    {/* 骨架分来源 */}
                    <div className="bg-blue-50/50 dark:bg-blue-950/10 rounded p-1.5">
                      <span className="font-medium text-primary/80">骨架分来源：</span>
                      <span className="text-muted-foreground">{debug.skeletonSource}</span>
                    </div>

                    {/* 计算参数 */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <div><span className="text-primary/70">骨架分：</span>{debug.skeletonScore.toFixed(1)}</div>
                      <div><span className="text-primary/70">天花板：</span>{debug.ceiling.toFixed(1)}</div>
                      <div><span className="text-primary/70">加分：</span>{debug.bonusTotal.toFixed(2)}</div>
                      <div><span className="text-primary/70">减分：</span>{debug.penaltyTotal.toFixed(2)}</div>
                      <div><span className="text-primary/70">禄存：</span>{debug.luCunDelta.toFixed(1)}</div>
                      <div><span className="text-primary/70">格局倍率：</span>{debug.patternMultiplier.toFixed(1)}</div>
                    </div>

                    {/* 加分明细 */}
                    {debug.bonusBreakdown.length > 0 && (
                      <div>
                        <span className="font-medium text-primary/80">加分明细（SKILL_V3.0 第二步）：</span>
                        <div className="mt-0.5 space-y-0.5">
                          {debug.bonusBreakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">{item.source}：{item.detail}</span>
                              <span className="text-green-600 font-medium">+{item.value.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 减分明细 */}
                    {debug.penaltyBreakdown.length > 0 && (
                      <div>
                        <span className="font-medium text-primary/80">减分明细（SKILL_V3.0 第四步）：</span>
                        <div className="mt-0.5 space-y-0.5">
                          {debug.penaltyBreakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">{item.source}：{item.detail}</span>
                              <span className="text-red-600 font-medium">{item.value.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 格局倍率来源 */}
                    <div className="bg-amber-50/50 dark:bg-amber-950/10 rounded p-1.5">
                      <span className="font-medium text-primary/80">格局倍率来源（SKILL_V3.0 第二步⑦）：</span>
                      <span className="text-muted-foreground">{debug.patternMultiplierSource}</span>
                    </div>

                    {/* 状态标记 */}
                    <div className="flex flex-wrap gap-1">
                      {debug.isAbsoluteFail && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-300 text-red-600">绝败</Badge>
                      )}
                      {debug.criticalStatus !== '无临界' && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-600">{debug.criticalStatus}</Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] px-1 py-0">制煞：{debug.subdueLevel}</Badge>
                    </div>

                    {/* 主星列表 */}
                    <div>
                      <span className="font-medium text-primary/80">主星：</span>
                      <span className="text-muted-foreground">
                        {debug.majorStars.map(ms => `${ms.star}(${ms.brightness})`).join('、')}
                      </span>
                    </div>

                    {/* 所有星曜（含四化） */}
                    {debug.allStars.length > 0 && (
                      <div>
                        <span className="font-medium text-primary/80">星曜清单：</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {debug.allStars.map((s, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[9px] px-1 py-0">
                              {s.name}
                              {s.sihua && (
                                <span className={
                                  s.sihua === '化禄' ? 'text-green-600' :
                                  s.sihua === '化权' ? 'text-blue-600' :
                                  s.sihua === '化科' ? 'text-purple-600' :
                                  'text-red-600'
                                }>·{s.sihua}</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 相关宫位 */}
                    {debug.relatedPalaces.length > 0 && (
                      <div>
                        <span className="font-medium text-primary/80">参与宫位：</span>
                        <span className="text-muted-foreground">
                          {debug.relatedPalaces.map(rp => `${rp.palace}${rp.diZhi}(${rp.role})`).join('、')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
      {displayResult && !loading && activeType !== "affair" && (
        <div className="rounded-lg border border-primary/10 bg-card p-3">
          {pipelineSnapshot && activeType && !isDebugTab(activeType) && (
            <Badge variant="outline" className="mb-2 text-[10px]">
              Hybrid Stage 管线
            </Badge>
          )}
          {activeType === "patterns" &&
            (pipelineSnapshot
              ? renderPatterns(pipelineSnapshot.patterns, pipelineSnapshot.dslPatternHits, true)
              : renderPatterns(legacyPatterns()))}
          {activeType === "all-palaces" &&
            (pipelineSnapshot ? renderPalaces(pipelineSnapshot.allPalaces, true) : renderPalaces(legacyPalaces()))}
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
