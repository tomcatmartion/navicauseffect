"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  CurrentDaXianDetail,
  DaXianTimelineEntry,
  DirectionMatrix,
  FourDimensionProjection,
  InnateLevelDetail,
  MatterAnalysisSummary,
  MatterResilienceResult,
  MatterScoreBreakdown,
  PalaceLayerEntry,
  ProtectionMechanismHit,
  SecondaryPalaceSnapshot,
  SihuaEntry,
  SihuaLandingReport,
  ThreeLayerPalaceTable,
  SihuaTrigger,
  PalaceScoreBrief,
} from "@/core/types";
import { SihuaLandingTable } from "./sihua-landing-table";

export interface MatterReportData {
  matterType?: string;
  affairText?: string;
  route?: {
    primaryPalace: string;
    secondaryPalaces: string[];
    specialConditions: string[];
    needInteraction: boolean;
    routingAnswers: Record<string, string>;
  };
  personalityAnchor?: string;
  personalityInfluence?: string;
  innateLevelDetail?: InnateLevelDetail;
  fourDimension?: FourDimensionProjection;
  fourDimensionFocus?: string[];
  secondaryPalaceSnapshots?: SecondaryPalaceSnapshot[];
  protectionMechanisms?: ProtectionMechanismHit[];
  currentDaXianQualitative?: string;
  currentDaXianDetail?: CurrentDaXianDetail;
  daXianTimeline?: DaXianTimelineEntry[];
  timeDimensions?: string[];
  directionMatrix?: string;
  causalChain?: string;
  luluJiFlow?: string[];
  liuNianSihuaPositions?: string[];
  analysisSummary?: MatterAnalysisSummary;
  scoreAction?: string;
  scoreLabel?: string;
  resilience?: MatterResilienceResult;
  scoreBreakdown?: MatterScoreBreakdown;
  slimmedDescriptions?: string[];
  sihuaLandingReport?: SihuaLandingReport;
  limitPatternsSynthesis?: string;
  /** 三层宫位对照表（原局/大限/流年各层宫位星曜+四化） */
  threeLayerTable?: ThreeLayerPalaceTable;
  sihuaTriggers?: SihuaTrigger[];
  daXianPalaceScores?: PalaceScoreBrief[];
  liuNianPalaceScores?: PalaceScoreBrief[];
  lifeTrend?: string;
  capabilityMatch?: string;
  /** 分析判定逻辑摘要（从 limit_direction.json 提取） */
  analysisLogic?: {
    compositeFormula: Record<string, unknown>;
    timeWeights: { daXian: number; liuNian: number; liuYue: number };
    directionJudgment: Record<string, { judgment: string; suggestion: string; description: string }>;
    analysisFlow: Array<{ step: number; name: string; content: string }>;
  };
}

interface MatterReportSectionsProps {
  data: MatterReportData;
}

const SECTION_IDS = {
  innate: "matter-innate",
  fortune: "matter-fortune",
  yearly: "matter-yearly",
  conclusion: "matter-conclusion",
  advice: "matter-advice",
  evidence: "matter-evidence",
} as const;

function ReportSection({
  id,
  title,
  defaultOpen,
  children,
}: {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group scroll-mt-4 rounded-md border border-primary/10 bg-card/50"
    >
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          {title}
          <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">▼</span>
        </span>
      </summary>
      <div className="border-t border-primary/10 px-3 pb-3 pt-2">{children}</div>
    </details>
  );
}

function MatterContextBar({ data }: { data: MatterReportData }) {
  const { route, matterType, affairText } = data;
  if (!route && !matterType) return null;

  return (
    <div className="rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-xs space-y-1.5">
      {(matterType || affairText) && (
        <p className="font-medium text-foreground">
          {matterType ?? "事项"}
          {affairText ? ` · ${affairText}` : ""}
        </p>
      )}
      {route && (
        <p>
          <span className="text-muted-foreground">主看：</span>
          <span className="font-medium">{route.primaryPalace}</span>
          {route.secondaryPalaces.length > 0 && (
            <>
              <span className="text-muted-foreground"> · 兼看：</span>
              {route.secondaryPalaces.join("、")}
            </>
          )}
        </p>
      )}
      {route?.specialConditions.length ? (
        <p className="text-muted-foreground">
          路由条件：{route.specialConditions.join("、")}
        </p>
      ) : null}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        以下「原局底盘」均为本命盘层合参，中心为问诊事项主宫，不含大限/流年叠宫。
      </p>
    </div>
  );
}

function FourDimensionGrid({ fd }: { fd: FourDimensionProjection }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">
        以事项主宫为中心的原局空间合参（本 / 对 / 合 / 临）
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-primary/10 p-2">
          <div className="text-muted-foreground">本宫 · 事项主宫 · {fd.self.palace}</div>
          <div className="font-medium">{fd.self.score.toFixed(1)} · {fd.self.tone}</div>
        </div>
        <div className="rounded border border-primary/10 p-2">
          <div className="text-muted-foreground">对宫 · {fd.opposite.palace}</div>
          <div className="font-medium">{fd.opposite.score.toFixed(1)} · {fd.opposite.tone}</div>
        </div>
        <div className="rounded border border-primary/10 p-2">
          <div className="text-muted-foreground">合宫 · {fd.trine.palaces.join("、")}</div>
          <div className="font-medium">{fd.trine.score.toFixed(1)}</div>
        </div>
        <div className="rounded border border-primary/10 p-2">
          <div className="text-muted-foreground">临宫 · {fd.flanking.palaces.join("、")}</div>
          <div className="font-medium">{fd.flanking.score.toFixed(1)} · {fd.flanking.tone}</div>
        </div>
      </div>
      {fd.summary && (
        <p className="text-[11px] text-muted-foreground leading-relaxed">{fd.summary}</p>
      )}
    </div>
  );
}

function SecondaryPalaceList({ items }: { items: SecondaryPalaceSnapshot[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">兼看宫位（原局）</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <Badge key={item.palace} variant="outline" className="text-[10px] font-normal">
            {item.palace} {item.score.toFixed(1)} · {item.tone}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SectionNav() {
  const links: Array<{ id: string; label: string }> = [
    { id: SECTION_IDS.innate, label: "原局" },
    { id: SECTION_IDS.fortune, label: "行运" },
    { id: SECTION_IDS.yearly, label: "流年" },
    { id: SECTION_IDS.conclusion, label: "结论" },
    { id: SECTION_IDS.advice, label: "建议" },
  ];
  return (
    <nav className="flex flex-wrap gap-1.5 text-[11px]">
      {links.map(link => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className="cursor-pointer rounded border border-primary/15 px-2 py-0.5 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

// ── 四化徽章颜色映射 ──
const SIHUA_COLORS: Record<string, string> = {
  '化禄': 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  '化权': 'border-blue-500/40 text-blue-700 dark:text-blue-400',
  '化科': 'border-purple-500/40 text-purple-700 dark:text-purple-400',
  '化忌': 'border-red-500/40 text-red-700 dark:text-red-400',
};

/** 四化徽章列表 */
function SihuaBadgeList({ sihua, compact }: { sihua: SihuaEntry[]; compact?: boolean }) {
  if (!sihua.length) return <span className="text-muted-foreground">无</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {sihua.map((s, i) => (
        <span
          key={i}
          className={`inline-block rounded border px-1 py-px text-[10px] leading-tight ${SIHUA_COLORS[s.type] ?? ''}`}
        >
          {s.type}{compact ? '' : s.star}
        </span>
      ))}
    </span>
  );
}

/** 从层中查找指定宫位 */
function findPalaceInLayer(layer: { palaces: PalaceLayerEntry[] } | undefined, name: string): PalaceLayerEntry | undefined {
  return layer?.palaces.find(p => p.name === name);
}

/** 宫位详情行：显示星曜、四化、评分 */
function PalaceDetailRow({
  palace,
  layerLabel,
}: {
  palace: PalaceLayerEntry;
  layerLabel: string;
}) {
  const starsText = palace.majorStars.length > 0
    ? palace.majorStars.map(s => `${s.star}${s.brightness && s.brightness !== '平' ? `(${s.brightness})` : ''}`).join(' ')
    : '无主星';
  const scoreText = palace.score != null ? ` · ${palace.score.toFixed(1)}分` : '';
  const toneText = palace.tone ? ` · ${palace.tone}` : '';

  return (
    <div className="rounded border border-primary/8 bg-muted/15 px-2 py-1.5 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{palace.name}</span>
        <span className="text-[10px] text-muted-foreground">{layerLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span>{starsText}</span>
        <span className="text-muted-foreground">{scoreText}{toneText}</span>
      </div>
      {palace.sihua.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground shrink-0">四化：</span>
          <SihuaBadgeList sihua={palace.sihua} />
        </div>
      )}
      {palace.tianGan && (
        <div className="text-[10px] text-muted-foreground">
          天干 {palace.tianGan} · 地支 {palace.diZhi}
        </div>
      )}
    </div>
  );
}

/** 方向矩阵格子（复用 hero 的模式） */
const MATRIX_CELLS: Array<{ row: '吉' | '凶'; col: '吉' | '凶'; key: string }> = [
  { row: '吉', col: '吉', key: '吉吉' },
  { row: '吉', col: '凶', key: '吉凶' },
  { row: '凶', col: '吉', key: '凶吉' },
  { row: '凶', col: '凶', key: '凶凶' },
];

/** 分析逻辑面板 — 综合子部分专用 */
function AnalysisLogicPanel({
  logic,
  currentMatrix,
  scoreBreakdown,
}: {
  logic: NonNullable<MatterReportData['analysisLogic']>;
  currentMatrix?: string;
  scoreBreakdown?: MatterScoreBreakdown;
}) {
  return (
    <div className="space-y-2.5">
      {/* 分析流程 */}
      {logic.analysisFlow.length > 0 && (
        <details className="rounded border border-primary/8 bg-muted/10" open>
          <summary className="cursor-pointer px-2 py-1 text-[11px] font-medium text-muted-foreground">
            分析流程（{logic.analysisFlow.length}步）
          </summary>
          <div className="border-t border-primary/8 px-2 py-1.5 space-y-1">
            {logic.analysisFlow.map(step => (
              <div key={step.step} className="text-[10px] leading-relaxed">
                <span className="text-muted-foreground">{step.step}.</span>
                <span className="font-medium"> {step.name}</span>
                <span className="text-muted-foreground"> — {step.content}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* 评分公式 */}
      <div className="rounded border border-primary/8 bg-muted/10 p-2 space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">评分公式</p>
        <div className="text-[10px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {Object.entries(logic.compositeFormula).map(([k, v]) => (
            <Fragment key={k}>
              <span className="text-muted-foreground whitespace-nowrap">{k}</span>
              <span>
                {typeof v === 'string'
                  ? v
                  : typeof v === 'number'
                    ? String(v)
                    : typeof v === 'object' && v !== null
                      ? Object.entries(v as Record<string, unknown>).map(([sk, sv]) =>
                          `${sk}:${typeof sv === 'object' ? JSON.stringify(sv) : String(sv)}`
                        ).join(' · ')
                      : String(v)}
              </span>
            </Fragment>
          ))}
        </div>
        {scoreBreakdown && (
          <div className="mt-1 pt-1 border-t border-primary/8 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-muted-foreground">原局底盘分</span>
            <span>{scoreBreakdown.originBase.toFixed(2)}</span>
            <span className="text-muted-foreground">大限激活分</span>
            <span>{scoreBreakdown.daXianActivation.toFixed(2)}</span>
            <span className="text-muted-foreground">流年引动分</span>
            <span>{scoreBreakdown.liuNianActivation.toFixed(2)}</span>
            <span className="text-muted-foreground">流月触发分</span>
            <span>{scoreBreakdown.liuYueActivation.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* 时间维度权重 */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-muted-foreground">权重：</span>
        <span>大限×{logic.timeWeights.daXian}</span>
        <span>流年×{logic.timeWeights.liuNian}</span>
        <span>流月×{logic.timeWeights.liuYue}</span>
      </div>

      {/* 方向矩阵判断 */}
      {Object.keys(logic.directionJudgment).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">方向矩阵判断（大限×流年）</p>
          <div className="inline-grid grid-cols-2 gap-1 text-[10px]">
            <div className="text-center text-muted-foreground col-span-2">流年 ↓ / 大限 →</div>
            {MATRIX_CELLS.map(cell => {
              const active = cell.key === currentMatrix;
              const info = logic.directionJudgment[cell.key];
              return (
                <div
                  key={cell.key}
                  className={`rounded border px-2 py-1 text-center ${
                    active
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-primary/10 text-muted-foreground'
                  }`}
                  title={info?.description ?? ''}
                >
                  <div>{cell.key}</div>
                  {info && <div className="text-[9px] font-normal">{info.judgment}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Fragment import shortcut
import { Fragment } from 'react';

export function MatterReportSections({ data }: MatterReportSectionsProps) {
  const currentDetail = data.currentDaXianDetail;

  return (
    <div className="space-y-2">
      <SectionNav />

      <ReportSection id={SECTION_IDS.innate} title="原局底盘" defaultOpen>
        <div className="space-y-3 text-xs">
          <MatterContextBar data={data} />

          {data.innateLevelDetail && (
            <div className="rounded border border-primary/10 p-2 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">先天格局（命宫能级）</p>
              <p>
                <span className="font-medium">{data.innateLevelDetail.level}</span>
                {" — "}
                {data.innateLevelDetail.description}
              </p>
              <p className="text-muted-foreground">
                承载力 {data.innateLevelDetail.carryingCapacity}
                {data.innateLevelDetail.advice ? ` · ${data.innateLevelDetail.advice}` : ""}
              </p>
            </div>
          )}

          {data.fourDimension && <FourDimensionGrid fd={data.fourDimension} />}

          {data.fourDimensionFocus && data.fourDimensionFocus.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              四维焦点：{data.fourDimensionFocus.join(" · ")}
            </p>
          )}

          {data.secondaryPalaceSnapshots && (
            <SecondaryPalaceList items={data.secondaryPalaceSnapshots} />
          )}

          {data.protectionMechanisms && data.protectionMechanisms.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">格局护佑</p>
              <ul className="list-inside list-disc text-muted-foreground space-y-0.5">
                {data.protectionMechanisms.map(m => (
                  <li key={m.id}>{m.description || m.id} — {m.effect}</li>
                ))}
              </ul>
            </div>
          )}

          {(data.personalityAnchor || data.personalityInfluence) && (
            <details className="rounded border border-primary/10 bg-muted/10 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                性格锚点（折叠）
              </summary>
              <div className="mt-1.5 space-y-1 text-muted-foreground leading-relaxed">
                {data.personalityAnchor && <p>{data.personalityAnchor}</p>}
                {data.personalityInfluence && (
                  <p className="text-[11px]">{data.personalityInfluence}</p>
                )}
              </div>
            </details>
          )}
        </div>
      </ReportSection>

      <ReportSection id={SECTION_IDS.fortune} title="行运脉络">
        <div className="space-y-2 text-xs">
          {currentDetail && (
            <div className="rounded border border-primary/25 bg-primary/5 px-2 py-1.5 space-y-0.5">
              <p className="font-medium">
                当前：第{currentDetail.index}限 {currentDetail.ageRange[0]}–{currentDetail.ageRange[1]}岁
              </p>
              <p>
                大限命宫 {currentDetail.mingPalaceName} · 天干 {currentDetail.daXianGan}
                {" · "}
                <Badge variant="outline" className="text-[10px] ml-0.5">
                  {currentDetail.qualitative}
                </Badge>
              </p>
            </div>
          )}
          {!currentDetail && data.currentDaXianQualitative && (
            <p>
              当前大限：
              <Badge variant="outline" className="ml-1">{data.currentDaXianQualitative}</Badge>
            </p>
          )}
          {data.timeDimensions && data.timeDimensions.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              时间维度：{data.timeDimensions.join(" → ")}
            </p>
          )}
          {data.daXianTimeline?.map(d => (
            <div
              key={d.index}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2 py-1 ${
                d.isCurrent ? "border-primary/30 bg-primary/5" : "border-primary/10"
              }`}
            >
              <span className="font-medium">第{d.index}限</span>
              <span>{d.ageRange}</span>
              {d.mingPalaceName && (
                <span className="text-muted-foreground">命宫·{d.mingPalaceName}</span>
              )}
              {d.daXianGan && (
                <span className="text-muted-foreground">{d.daXianGan}</span>
              )}
              <Badge variant="outline" className="text-[10px]">{d.qualitative}</Badge>
              {d.isCurrent && <span className="text-primary text-[11px]">← 当前</span>}
            </div>
          ))}
          {(data.lifeTrend || data.capabilityMatch) && (
            <p className="text-[11px] text-muted-foreground">
              {data.lifeTrend && <>人生趋势：{data.lifeTrend}</>}
              {data.lifeTrend && data.capabilityMatch && " · "}
              {data.capabilityMatch && <>能力匹配：{data.capabilityMatch}</>}
            </p>
          )}
          {data.daXianPalaceScores && data.daXianPalaceScores.length > 0 && (
            <details className="rounded border border-primary/10 bg-muted/10 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                大限十二宫独立评分 ▾
              </summary>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:grid-cols-3">
                {data.daXianPalaceScores.map(p => (
                  <span key={p.palaceIndex}>
                    {p.palaceName} {p.score.toFixed(1)} · {p.level}
                  </span>
                ))}
              </div>
            </details>
          )}
          {data.analysisSummary?.fortuneTrend && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {data.analysisSummary.fortuneTrend}
            </p>
          )}
        </div>
      </ReportSection>

      <ReportSection id={SECTION_IDS.yearly} title="流年引动">
        <div className="space-y-2 text-xs">
          {data.directionMatrix && (
            <p>
              <span className="text-muted-foreground">方向矩阵：</span>
              {data.directionMatrix}
              <span className="text-muted-foreground">（大限×流年）</span>
            </p>
          )}
          {data.causalChain && <p className="leading-relaxed">{data.causalChain}</p>}
          {data.sihuaTriggers && data.sihuaTriggers.length > 0 && (
            <div className="space-y-1 rounded border border-primary/10 bg-muted/10 px-2 py-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">三代四化引动</p>
              {data.sihuaTriggers.slice(0, 6).map((t, i) => (
                <p key={`${t.triggerLevel}-${t.targetLevel}-${t.type}-${t.relation}-${t.targetPalace}-${i}`} className="text-[11px] leading-relaxed">
                  [{t.triggerLevel === "daXian" ? "大限" : "流年"}→{t.targetLevel === "yuanJu" ? "原局" : "大限"}]
                  {t.type}·{t.relation}：{t.effect}
                </p>
              ))}
            </div>
          )}
          {data.liuNianPalaceScores && data.liuNianPalaceScores.length > 0 && (
            <details className="rounded border border-primary/10 bg-muted/10 px-2 py-1.5">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                流年十二宫独立评分 ▾
              </summary>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:grid-cols-3">
                {data.liuNianPalaceScores.map(p => (
                  <span key={p.palaceIndex}>
                    {p.palaceName} {p.score.toFixed(1)} · {p.level}
                  </span>
                ))}
              </div>
            </details>
          )}
          {data.luluJiFlow && data.luluJiFlow.length > 0 && (
            <div className="text-amber-800 dark:text-amber-300 space-y-0.5">
              {data.luluJiFlow.map((flow, i) => <p key={i}>{flow}</p>)}
            </div>
          )}
          {data.liuNianSihuaPositions && data.liuNianSihuaPositions.length > 0 && (
            <p>{data.liuNianSihuaPositions.join(" · ")}</p>
          )}
          {data.analysisSummary?.yearlyTrigger && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {data.analysisSummary.yearlyTrigger}
            </p>
          )}
        </div>
      </ReportSection>

      <ReportSection id={SECTION_IDS.conclusion} title="综合结论" defaultOpen>
        <div className="space-y-1.5 text-xs">
          {data.analysisSummary && (
            <>
              {/* 原局 */}
              <div>
                <p><span className="text-muted-foreground">原局：</span>{data.analysisSummary.innateBase}</p>
                {(data.threeLayerTable || data.route) && (
                  <details className="mt-1 rounded border border-primary/8 bg-muted/10">
                    <summary className="cursor-pointer px-2 py-1 text-[10px] text-muted-foreground">
                      原局详情 ▾
                    </summary>
                    <div className="border-t border-primary/8 px-2 py-1.5 space-y-1.5">
                      {data.route && data.threeLayerTable?.natal && (() => {
                        const primary = findPalaceInLayer(data.threeLayerTable.natal, data.route.primaryPalace);
                        return primary ? <PalaceDetailRow palace={primary} layerLabel="原局·主看" /> : null;
                      })()}
                      {data.route?.secondaryPalaces && data.threeLayerTable?.natal &&
                        data.route.secondaryPalaces.map(name => {
                          const p = findPalaceInLayer(data.threeLayerTable!.natal, name);
                          return p ? <PalaceDetailRow key={name} palace={p} layerLabel="原局·兼看" /> : null;
                        })
                      }
                      {data.protectionMechanisms && data.protectionMechanisms.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          护佑：{data.protectionMechanisms.map(m => m.id).join('、')}
                        </div>
                      )}
                      {data.fourDimension && (
                        <div className="text-[10px] text-muted-foreground">
                          四维：本宫{data.fourDimension.self.score.toFixed(1)} · 对宫{data.fourDimension.opposite.score.toFixed(1)} · 合宫{data.fourDimension.trine.score.toFixed(1)} · 临宫{data.fourDimension.flanking.score.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* 大限 */}
              <div>
                <p><span className="text-muted-foreground">大限：</span>{data.analysisSummary.fortuneTrend}</p>
                {(data.threeLayerTable || data.currentDaXianDetail) && (
                  <details className="mt-1 rounded border border-primary/8 bg-muted/10">
                    <summary className="cursor-pointer px-2 py-1 text-[10px] text-muted-foreground">
                      大限详情 ▾
                    </summary>
                    <div className="border-t border-primary/8 px-2 py-1.5 space-y-1.5">
                      {data.currentDaXianDetail && (
                        <div className="text-[10px]">
                          <span className="font-medium">第{data.currentDaXianDetail.index}限</span>
                          {' · '}{data.currentDaXianDetail.ageRange[0]}–{data.currentDaXianDetail.ageRange[1]}岁
                          {' · '}天干{data.currentDaXianDetail.daXianGan}
                          {' · '}命宫{data.currentDaXianDetail.mingPalaceName}
                          {' · '}<span className="text-muted-foreground">{data.currentDaXianDetail.qualitative}</span>
                        </div>
                      )}
                      {data.route && data.threeLayerTable?.decadal && (() => {
                        const primary = findPalaceInLayer(data.threeLayerTable.decadal, data.route.primaryPalace);
                        return primary ? <PalaceDetailRow palace={primary} layerLabel="大限·事项宫" /> : null;
                      })()}
                      {data.route?.secondaryPalaces && data.threeLayerTable?.decadal &&
                        data.route.secondaryPalaces.map(name => {
                          const p = findPalaceInLayer(data.threeLayerTable!.decadal, name);
                          return p ? <PalaceDetailRow key={name} palace={p} layerLabel="大限·兼看" /> : null;
                        })
                      }
                    </div>
                  </details>
                )}
              </div>

              {/* 流年 */}
              <div>
                <p><span className="text-muted-foreground">流年：</span>{data.analysisSummary.yearlyTrigger}</p>
                {(data.threeLayerTable || data.liuNianSihuaPositions) && (
                  <details className="mt-1 rounded border border-primary/8 bg-muted/10">
                    <summary className="cursor-pointer px-2 py-1 text-[10px] text-muted-foreground">
                      流年详情 ▾
                    </summary>
                    <div className="border-t border-primary/8 px-2 py-1.5 space-y-1.5">
                      {data.route && data.threeLayerTable?.yearly && (() => {
                        const primary = findPalaceInLayer(data.threeLayerTable.yearly, data.route.primaryPalace);
                        return primary ? <PalaceDetailRow palace={primary} layerLabel="流年·事项宫" /> : null;
                      })()}
                      {data.route?.secondaryPalaces && data.threeLayerTable?.yearly &&
                        data.route.secondaryPalaces.map(name => {
                          const p = findPalaceInLayer(data.threeLayerTable!.yearly, name);
                          return p ? <PalaceDetailRow key={name} palace={p} layerLabel="流年·兼看" /> : null;
                        })
                      }
                      {data.liuNianSihuaPositions && data.liuNianSihuaPositions.length > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          四化落位：{data.liuNianSihuaPositions.join(' · ')}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {/* 综合 */}
              <div>
                <p className="font-medium">
                  <span className="text-muted-foreground font-normal">综合：</span>
                  {data.analysisSummary.compositeConclusion}
                </p>
                {data.analysisLogic && (
                  <details className="mt-1 rounded border border-primary/8 bg-muted/10">
                    <summary className="cursor-pointer px-2 py-1 text-[10px] text-muted-foreground">
                      分析判定逻辑 ▾
                    </summary>
                    <div className="border-t border-primary/8 px-2 py-1.5">
                      <AnalysisLogicPanel
                        logic={data.analysisLogic}
                        currentMatrix={data.directionMatrix}
                        scoreBreakdown={data.scoreBreakdown}
                      />
                    </div>
                  </details>
                )}
              </div>
            </>
          )}
          {data.limitPatternsSynthesis && (
            <p className="text-[11px] text-muted-foreground">{data.limitPatternsSynthesis}</p>
          )}
        </div>
      </ReportSection>

      <ReportSection id={SECTION_IDS.advice} title="调整建议">
        <div className="space-y-2 text-xs">
          {data.scoreAction && (
            <p className="font-medium">{data.scoreAction}</p>
          )}
          {data.analysisSummary?.riskAdvice && (
            <p className="leading-relaxed">{data.analysisSummary.riskAdvice}</p>
          )}
          {data.resilience && (
            <Badge variant="outline">{data.resilience.strategy}</Badge>
          )}
        </div>
      </ReportSection>

      <ReportSection id={SECTION_IDS.evidence} title="分析依据（折叠）">
        <div className="space-y-3 text-xs">
          {data.scoreBreakdown && (
            <div className="rounded border bg-muted/20 p-2 text-[10px] grid grid-cols-2 gap-x-4 gap-y-1">
              <span>原局底盘分</span><span>{data.scoreBreakdown.originBase.toFixed(2)}</span>
              <span>大限激活分</span><span>{data.scoreBreakdown.daXianActivation.toFixed(2)}</span>
              <span>流年引动分</span><span>{data.scoreBreakdown.liuNianActivation.toFixed(2)}</span>
              <span>流月触发分</span><span>{data.scoreBreakdown.liuYueActivation.toFixed(2)}</span>
            </div>
          )}
          {data.slimmedDescriptions && data.slimmedDescriptions.length > 0 && (
            <ul className="list-inside list-disc text-muted-foreground">
              {data.slimmedDescriptions.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
          {data.sihuaLandingReport && (
            <SihuaLandingTable report={data.sihuaLandingReport} />
          )}
        </div>
      </ReportSection>
    </div>
  );
}
