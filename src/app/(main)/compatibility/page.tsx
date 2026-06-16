"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Heart,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ChartPicker {
  id: string;
  name: string;
  birthSolarDate: string;
  identityId: string;
  summary: {
    mingGongMajorStars: string[];
    shenGongName: string;
  } | null;
}

interface CompatibilityResult {
  palaceComparison: Array<{
    palace: string;
    self: { stars: string[] };
    partner: { stars: string[] };
    harmony: 'harmony' | 'tension' | 'neutral';
    note: string;
  }>;
  crossSihua: Array<{
    from: 'self' | 'partner';
    type: '禄' | '权' | '科' | '忌';
    star: string;
    landsInPartnerPalace: string;
    note: string;
  }>;
  starInteraction: Array<{
    selfStar: string;
    partnerStar: string;
    palace: string;
    relation: '同宫' | '对宫' | '三合';
    nature: '吉' | '凶' | '中性';
    note: string;
  }>;
  dimensionScores: {
    emotion: number;
    career: number;
    wealth: number;
    communication: number;
    family: number;
    overall: number;
  };
  highlights: string[];
  risks: string[];
}

interface Analysis {
  id: string;
  result: CompatibilityResult;
  aiSummary: string | null;
  selfChart: { id: string; name: string };
  partnerChart: { id: string; name: string };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 主内容（用 useSearchParams 需 Suspense）
// ---------------------------------------------------------------------------

function CompatibilityContent() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [charts, setCharts] = useState<ChartPicker[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [selfChartId, setSelfChartId] = useState<string>("");
  const [partnerChartId, setPartnerChartId] = useState<string>("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [histories, setHistories] = useState<Analysis[]>([]);

  const fetchCharts = useCallback(async () => {
    try {
      const res = await fetch("/api/charts");
      if (res.ok) {
        const data = await res.json();
        setCharts(data.charts ?? []);
      }
    } finally {
      setLoadingCharts(false);
    }
  }, []);

  const fetchHistories = useCallback(async () => {
    try {
      const res = await fetch("/api/ziwei/compatibility");
      if (res.ok) {
        const data = await res.json();
        setHistories(data.analyses ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (sessionStatus === "authenticated") {
      fetchCharts();
      fetchHistories();
      // URL 参数预填 selfChartId
      const pre = searchParams.get("selfChartId");
      if (pre) setSelfChartId(pre);
    }
  }, [sessionStatus, router, fetchCharts, fetchHistories, searchParams]);

  const handleAnalyze = async () => {
    if (!selfChartId || !partnerChartId) {
      toast.error("请选择两个命盘");
      return;
    }
    if (selfChartId === partnerChartId) {
      toast.error("不能与自己合盘");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ziwei/compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfChartId, partnerChartId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
        if (!data.cached) toast.success("合盘分析完成");
        fetchHistories();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "分析失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingCharts) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b border-primary/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <h1 className="font-serif-sc text-sm font-bold text-foreground flex items-center gap-1">
            <Heart className="w-4 h-4 text-primary" />
            合盘分析
          </h1>
          <div className="w-12" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {charts.length < 2 ? (
          <Card className="border-primary/10">
            <CardContent className="p-8 text-center space-y-3">
              <Sparkles className="w-12 h-12 text-primary/40 mx-auto" />
              <p className="font-serif-sc text-sm font-bold">至少需要 2 张已保存的命盘</p>
              <p className="text-xs text-muted-foreground">
                请先在排盘页保存至少 2 张命盘（自己 + 对方），才能进行合盘分析
              </p>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => router.push("/chart")}
              >
                去排盘
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 命盘选择 */}
            <Card className="border-primary/10">
              <CardContent className="p-4 space-y-3">
                <h2 className="font-serif-sc text-sm font-bold">选择命盘</h2>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">自己（甲方）</label>
                  <select
                    value={selfChartId}
                    onChange={(e) => setSelfChartId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                  >
                    <option value="">请选择...</option>
                    {charts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}（{c.summary?.mingGongMajorStars.join("·") ?? "空宫"}）
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">对方（乙方）</label>
                  <select
                    value={partnerChartId}
                    onChange={(e) => setPartnerChartId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                  >
                    <option value="">请选择...</option>
                    {charts
                      .filter((c) => c.id !== selfChartId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.summary?.mingGongMajorStars.join("·") ?? "空宫"}）
                        </option>
                      ))}
                  </select>
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!selfChartId || !partnerChartId || analyzing}
                  onClick={handleAnalyze}
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中（AI 解读需 ~30 秒）...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4 mr-2" />
                      开始合盘
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* 历史记录 */}
            {!analysis && histories.length > 0 && (
              <Card className="border-primary/10">
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-serif-sc text-sm font-bold text-muted-foreground">历史合盘</h3>
                  {histories.slice(0, 5).map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setAnalysis(h)}
                      className="block w-full text-left p-2 rounded-md hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          {h.selfChart.name} × {h.partnerChart.name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          综合 {h.result.dimensionScores.overall}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(h.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 合盘结果 */}
            {analysis && (
              <CompatibilityResultView analysis={analysis} onReset={() => setAnalysis(null)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 结果展示
// ---------------------------------------------------------------------------

function CompatibilityResultView({
  analysis,
  onReset,
}: {
  analysis: Analysis;
  onReset: () => void;
}) {
  const r = analysis.result;
  const dims = [
    { key: 'emotion', label: '情感' },
    { key: 'career', label: '事业' },
    { key: 'wealth', label: '财运' },
    { key: 'communication', label: '沟通' },
    { key: 'family', label: '家庭' },
  ] as const;

  const scoreColor = (s: number) =>
    s >= 75 ? 'text-green-600' : s >= 50 ? 'text-amber-600' : 'text-red-500';

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif-sc text-base font-bold">
            {analysis.selfChart.name} × {analysis.partnerChart.name}
          </h2>
          <p className="text-xs text-muted-foreground">
            {new Date(analysis.createdAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RefreshCw className="w-3 h-3 mr-1" />
          重新选
        </Button>
      </div>

      {/* 综合评分 */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 text-center space-y-3">
          <div className="text-xs text-muted-foreground">综合契合度</div>
          <div className={`text-5xl font-bold ${scoreColor(r.dimensionScores.overall)}`}>
            {r.dimensionScores.overall}
          </div>
          <div className="flex justify-center gap-3 flex-wrap">
            {dims.map((d) => (
              <div key={d.key} className="text-center">
                <div className="text-xs text-muted-foreground">{d.label}</div>
                <div className={`text-lg font-bold ${scoreColor(r.dimensionScores[d.key])}`}>
                  {r.dimensionScores[d.key]}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 关键亮点 / 风险 */}
      {(r.highlights.length > 0 || r.risks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {r.highlights.length > 0 && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs font-bold text-green-700">
                  <TrendingUp className="w-3 h-3" />
                  关键亮点
                </div>
                {r.highlights.map((h, i) => (
                  <p key={i} className="text-xs text-green-800">• {h}</p>
                ))}
              </CardContent>
            </Card>
          )}
          {r.risks.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center gap-1 text-xs font-bold text-amber-700">
                  <AlertTriangle className="w-3 h-3" />
                  风险提示
                </div>
                {r.risks.map((r2, i) => (
                  <p key={i} className="text-xs text-amber-800">• {r2}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 四化交叉 */}
      {r.crossSihua.length > 0 && (
        <Card className="border-primary/10">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-serif-sc text-sm font-bold">四化交叉</h3>
            <div className="space-y-1.5">
              {r.crossSihua.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    className={`shrink-0 ${
                      s.type === '禄'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : s.type === '忌'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : s.type === '权'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {s.from === 'self' ? '我' : '对方'}·化{s.type}
                  </Badge>
                  <span className="text-foreground">{s.note}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 星曜互动 */}
      {r.starInteraction.length > 0 && (
        <Card className="border-primary/10">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-serif-sc text-sm font-bold">星曜互动</h3>
            <div className="space-y-1.5">
              {r.starInteraction.slice(0, 10).map((it, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${
                      it.nature === '吉'
                        ? 'border-green-300 text-green-700'
                        : it.nature === '凶'
                        ? 'border-red-300 text-red-700'
                        : ''
                    }`}
                  >
                    {it.relation}·{it.nature}
                  </Badge>
                  <span className="text-foreground">{it.note}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 宫位对照 */}
      <Card className="border-primary/10">
        <CardContent className="p-4 space-y-2">
          <h3 className="font-serif-sc text-sm font-bold">十二宫对照</h3>
          <div className="space-y-1.5">
            {r.palaceComparison
              .filter((p) => p.harmony !== 'neutral')
              .map((p, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded-md ${
                    p.harmony === 'harmony'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800'
                  }`}
                >
                  <div className="font-bold">
                    {p.palace} {p.harmony === 'harmony' ? '✓' : '⚠'}
                  </div>
                  <div className="opacity-90">{p.note}</div>
                  <div className="opacity-75 mt-0.5">
                    我：{p.self.stars.join('·') || '空'} | 对方：{p.partner.stars.join('·') || '空'}
                  </div>
                </div>
              ))}
            {r.palaceComparison.every((p) => p.harmony === 'neutral') && (
              <p className="text-xs text-muted-foreground">十二宫能量平稳，无显著吉凶对照</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI 解读 */}
      {analysis.aiSummary && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-serif-sc text-sm font-bold flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-primary" />
              AI 深度解读
            </h3>
            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {analysis.aiSummary}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CompatibilityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>}>
      <CompatibilityContent />
    </Suspense>
  );
}
