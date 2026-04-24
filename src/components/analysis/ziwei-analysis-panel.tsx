"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  { id: "patterns" as const, label: "格局识别", icon: "🏆", desc: "识别命盘中的吉凶格局" },
  { id: "all-palaces" as const, label: "宫位能级", icon: "📊", desc: "评估十二宫位能量等级" },
  { id: "personality" as const, label: "性格分析", icon: "🔮", desc: "命主性格特质解读" },
  { id: "affair" as const, label: "事项分析", icon: "🎯", desc: "具体事项运势解读" },
];

const AFFAIR_TYPES = [
  { value: "求学", label: "求学/考试" },
  { value: "求爱", label: "感情恋爱" },
  { value: "求财", label: "财运投资" },
  { value: "求职", label: "工作事业" },
  { value: "求健康", label: "身体健康" },
  { value: "求名", label: "名声发展" },
];

const PALACE_NAMES = [
  "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
  "迁移", "仆役", "官禄", "田宅", "福德", "父母"
];

export function ZiweiAnalysisPanel({ birthData, currentAge }: ZiweiAnalysisPanelProps) {
  const [activeType, setActiveType] = useState<AnalysisType | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAffair, setSelectedAffair] = useState("求财");
  const [affairInput, setAffairInput] = useState("投资赚钱");

  const handleAnalyze = async (type: AnalysisType) => {
    setActiveType(type);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = {
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

  const EFFECT_LABELS: Record<string, string> = {
    positive: "吉利",
    negative: "凶象",
    mixed: "吉凶参半",
  };

  const renderPatterns = (patterns: any[]) => {
    if (!patterns || patterns.length === 0) {
      return <p className="text-muted-foreground">未识别到特殊格局</p>;
    }

    const grouped = patterns.reduce((acc, p) => {
      const group = p.category || "其他";
      if (!acc[group]) acc[group] = [];
      acc[group].push(p);
      return acc;
    }, {} as Record<string, any[]>);

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <h4 className="mb-2 font-medium text-sm text-muted-foreground">
              {category}格局
            </h4>
            <div className="space-y-2">
              {(items as any[]).map((p: any, i: number) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    p.effect === "positive"
                      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                      : p.effect === "negative"
                      ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800"
                      : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {p.source === "natal" ? "原局" : p.source === "decennial" ? "大限" : p.source === "annual" ? "流年" : p.source}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {EFFECT_LABELS[p.effect] || p.effect}
                    </Badge>
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mb-1">
                      {p.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPalaces = (assessments: Record<string, any>) => {
    return (
      <div className="space-y-3">
        {Object.entries(assessments).map(([branch, data]: [string, any]) => (
          <div key={branch} className="p-3 rounded-lg border border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {data.palace} ({branch})
              </span>
              <Badge
                variant={data.finalScore >= 6 ? "default" : "secondary"}
                className={
                  data.finalScore >= 8
                    ? "bg-emerald-600"
                    : data.finalScore >= 6
                    ? "bg-blue-600"
                    : ""
                }
              >
                {data.finalScore.toFixed(1)}分
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.level}</p>
            {data.traits?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {data.traits.slice(0, 3).map((trait: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {trait}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderPersonality = (profile: any) => {
    return (
      <div className="space-y-4">
        {profile.overview && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-sm leading-relaxed">{profile.overview}</p>
          </div>
        )}

        {/* 性格特质分层 */}
        {profile.traits && (
          <div>
            <h4 className="mb-2 font-medium">性格特质</h4>
            <div className="space-y-2">
              {profile.traits.surface?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">表层特质（命宫）</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.traits.surface.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.traits.middle?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">中层特质（身宫）</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.traits.middle.map((t: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {profile.traits.core?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">核心特质（太岁宫）</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.traits.core.map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs border-primary/40">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 优势 */}
        {profile.strengths?.length > 0 && (
          <div>
            <h4 className="mb-2 font-medium">优势</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {profile.strengths.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 劣势/挑战 */}
        {profile.weaknesses?.length > 0 && (
          <div>
            <h4 className="mb-2 font-medium">挑战</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {profile.weaknesses.map((w: string, i: number) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 行为模式 */}
        {profile.behaviorPatterns && (
          <div>
            <h4 className="mb-2 font-medium">行为模式</h4>
            <div className="space-y-2 text-sm">
              {profile.behaviorPatterns.proactive?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">主动行为</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1">
                    {profile.behaviorPatterns.proactive.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {profile.behaviorPatterns.reactive?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">被动反应</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1">
                    {profile.behaviorPatterns.reactive.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {profile.behaviorPatterns.stress?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">压力下行为</span>
                  <ul className="list-disc list-inside text-muted-foreground mt-1">
                    {profile.behaviorPatterns.stress.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 建议：advice 是对象 { overall, career, relationship, health } */}
        {profile.advice && (
          <div>
            <h4 className="mb-2 font-medium">建议</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              {profile.advice.overall && <p>{profile.advice.overall}</p>}
              {profile.advice.career && (
                <p><span className="font-medium text-foreground">事业：</span>{profile.advice.career}</p>
              )}
              {profile.advice.relationship && (
                <p><span className="font-medium text-foreground">感情：</span>{profile.advice.relationship}</p>
              )}
              {profile.advice.health && (
                <p><span className="font-medium text-foreground">健康：</span>{profile.advice.health}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAffair = (analysis: any) => {
    return (
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <h4 className="font-medium mb-1">总体判断</h4>
          <p className="text-sm">{analysis.overview}</p>
        </div>

        {analysis.natal?.patterns?.length > 0 && (
          <div>
            <h4 className="mb-2 font-medium">原局格局</h4>
            <div className="space-y-2">
              {analysis.natal.patterns.map((p: any, i: number) => (
                <div key={i} className="text-sm">
                  <Badge variant="outline" className="mr-2">
                    {p.category}
                  </Badge>
                  {p.name}: {p.effect}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 font-medium">综合结论</h4>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">成功率：</span>{analysis.conclusion?.probability}</p>
            {analysis.conclusion?.opportunities?.length > 0 && (
              <div>
                <span className="font-medium">机会点：</span>
                <ul className="list-disc list-inside ml-4 text-muted-foreground">
                  {analysis.conclusion.opportunities.map((o: string, i: number) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.conclusion?.obstacles?.length > 0 && (
              <div>
                <span className="font-medium">潜在障碍：</span>
                <ul className="list-disc list-inside ml-4 text-muted-foreground">
                  {analysis.conclusion.obstacles.map((o: string, i: number) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-medium">建议</h4>
          <div className="space-y-2 text-sm">
            {analysis.advice?.strategy?.map((s: string, i: number) => (
              <p key={i} className="text-muted-foreground">• {s}</p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="mb-2 font-[var(--font-serif-sc)] text-xl font-bold text-primary md:text-2xl">
          紫微斗数规则解析
        </h2>
        <p className="text-sm text-muted-foreground">
          基于传统紫微斗数理论的规则分析引擎
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ANALYSIS_OPTIONS.map((opt) => (
          <Card
            key={opt.id}
            className={`cursor-pointer border transition-all hover:shadow-md ${
              activeType === opt.id
                ? "border-primary bg-primary/5 shadow-md"
                : "border-primary/10 hover:border-primary/30"
            }`}
            onClick={() => handleAnalyze(opt.id)}
          >
            <CardContent className="flex flex-col items-center p-3 text-center">
              <span className="mb-1 text-2xl">{opt.icon}</span>
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground mt-1">
                {opt.desc}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeType === "affair" && !result && !error && (
        <Card className="border-primary/15">
          <CardHeader>
            <CardTitle className="text-base">选择事项类型</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">事项类型</label>
              <Select value={selectedAffair} onValueChange={setSelectedAffair}>
                <SelectTrigger>
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
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">具体描述</label>
              <input
                type="text"
                value={affairInput}
                onChange={(e) => setAffairInput(e.target.value)}
                placeholder="例如：投资股票、换工作、考研等"
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <Button
              onClick={() => handleAnalyze("affair")}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  开始分析
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <Card className="border-primary/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ANALYSIS_OPTIONS.find((o) => o.id === activeType)?.icon}
              {ANALYSIS_OPTIONS.find((o) => o.id === activeType)?.label}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                规则解析
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeType === "patterns" && renderPatterns(result)}
            {activeType === "all-palaces" && renderPalaces(result)}
            {activeType === "personality" && renderPersonality(result)}
            {activeType === "affair" && renderAffair(result)}
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="border-primary/15">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              正在分析中...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
