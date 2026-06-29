"use client";

import { useEffect, useState, useCallback, Suspense, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { useRequirePhoneBinding } from "@/lib/auth/use-require-phone-binding";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { usePaywall } from "@/components/shared/paywall-dialog";
import { ErrorRetryCard } from "@/components/shared/error-retry-card";
import { LoadingState } from "@/components/shared/loading-state";

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
// 工具
// ---------------------------------------------------------------------------

const scoreClass = (s: number): string =>
  s >= 75 ? "high" : s >= 50 ? "mid" : "low";

const sihuaColor = (t: '禄' | '权' | '科' | '忌'): CSSProperties => {
  switch (t) {
    case '禄': return { background: "var(--success-soft, rgba(44,74,30,.08))", color: "var(--success)", border: "1px solid var(--success)" };
    case '忌': return { background: "var(--danger-soft, rgba(139,26,26,.08))", color: "var(--danger)", border: "1px solid var(--danger)" };
    case '权': return { background: "var(--warning-soft, rgba(196,154,74,.1))", color: "var(--warning)", border: "1px solid var(--warning)" };
    case '科': return { background: "var(--soft)", color: "var(--brand)", border: "1px solid var(--brand)" };
  }
};

// ---------------------------------------------------------------------------
// 主内容
// ---------------------------------------------------------------------------

function CompatibilityContent() {
  const { status: sessionStatus } = useSession();
  const requirePhoneBinding = useRequirePhoneBinding();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showPaywall } = usePaywall();

  const [charts, setCharts] = useState<ChartPicker[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [selfChartId, setSelfChartId] = useState<string>("");
  const [partnerChartId, setPartnerChartId] = useState<string>("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [histories, setHistories] = useState<Analysis[]>([]);
  // O-16：合盘 loading 阶段文案（每 ~8 秒切换）
  const [analyzePhase, setAnalyzePhase] = useState(0);
  // O-09：分析失败时展示结构化错误卡片
  const [analysisError, setAnalysisError] = useState<{ title: string; detail: string; code?: string | number } | null>(null);
  const ANALYZE_PHASES = [
    { icon: "ti-database", text: "加载命盘数据…" },
    { icon: "ti-brain", text: "AI 正在分析契合度…" },
    { icon: "ti-file-text", text: "生成合盘报告…" },
  ];

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
    // B-17：微信登录用户付费前强制绑定手机
    if (requirePhoneBinding()) return;
    setAnalyzing(true);
    setAnalyzePhase(0);
    setAnalysisError(null);
    // O-16：阶段文案轮播
    const phaseTimer = setInterval(() => {
      setAnalyzePhase((p) => Math.min(p + 1, ANALYZE_PHASES.length - 1));
    }, 8000);
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
      } else if (res.status === 402) {
        // S-08：触发统一付费前置弹层
        const err = await res.json().catch(() => ({}));
        showPaywall({
          reason: (err as Record<string, string>).code,
          message: (err as Record<string, string>).error,
          resource: "COMPATIBILITY",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.error ?? "分析失败";
        setAnalysisError({ title: "合盘分析失败", detail: msg, code: res.status });
      }
    } catch {
      setAnalysisError({ title: "网络错误", detail: "无法连接到服务，请检查网络后重试", code: "NETWORK_ERROR" });
    } finally {
      clearInterval(phaseTimer);
      setAnalyzing(false);
    }
  };

  if (loadingCharts) {
    return (
      <PageContainer maxWidth={900}>
        <LoadingState title="加载命盘列表中…" description="请稍候" />
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth={900}>
      <SectionTitle as="h1" icon="ti-hearts" title="双人合盘" />

      {charts.length < 2 ? (
        <div
          className="card"
          style={{
            marginTop: 16,
            padding: 28,
            textAlign: "center",
            borderColor: "var(--brand)",
            background: "linear-gradient(135deg, var(--soft), var(--panel))",
          }}
        >
          {/* 进度环 */}
          <div
            style={{
              width: 88,
              height: 88,
              margin: "0 auto 16px",
              position: "relative",
              borderRadius: "50%",
              background: `conic-gradient(var(--brand) ${(charts.length / 2) * 360}deg, var(--line) 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: "var(--panel)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 0,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--brand)" }}>
                {charts.length}/2
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>已保存</span>
            </div>
          </div>

          <h3
            className="home-section-title"
            style={{ fontSize: 16, color: "var(--brand)", marginBottom: 6 }}
          >
            {charts.length === 0
              ? "开始排盘，开启合盘分析"
              : "再排一张盘即可合盘"}
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 18px", lineHeight: 1.7 }}>
            合盘需要 2 张已保存的命盘（自己 + 对方）。
            {charts.length === 1 && " 您已有 1 张盘，再排一张即可开始。"}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/chart")}
            style={{ minWidth: 140 }}
          >
            <i className="ti ti-stars" /> {charts.length === 0 ? "去排盘" : "再排一张"}
          </button>
        </div>
      ) : (
        <>
          {/* 选择区 */}
          <div className="card" style={{ marginTop: 16 }}>
            <SectionTitle icon="ti-arrows-left-right" title="选择命盘" />

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                自己（甲方）
              </label>
              <select
                className="select"
                value={selfChartId}
                onChange={(e) => setSelfChartId(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">请选择...</option>
                {charts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{c.summary?.mingGongMajorStars.join("·") ?? "空宫"}）
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                对方（乙方）
              </label>
              <select
                className="select"
                value={partnerChartId}
                onChange={(e) => setPartnerChartId(e.target.value)}
                style={{ width: "100%" }}
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

            <button
              className="btn btn-primary"
              disabled={!selfChartId || !partnerChartId || analyzing}
              style={{ width: "100%", marginTop: 16, opacity: !selfChartId || !partnerChartId ? 0.6 : 1 }}
              onClick={handleAnalyze}
            >
              {analyzing ? (
                <>
                  <i className={`ti ${ANALYZE_PHASES[analyzePhase].icon} ti-spin`} />
                  {ANALYZE_PHASES[analyzePhase].text}
                </>
              ) : (
                <><i className="ti ti-heart" /> 开始合盘</>
              )}
            </button>

            {/* O-16：阶段进度指示 */}
            {analyzing && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 11,
                }}
              >
                {ANALYZE_PHASES.map((p, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: i <= analyzePhase ? "var(--brand)" : "var(--soft)",
                      color: i <= analyzePhase ? "#fff" : "var(--text-muted)",
                      transition: "all .2s",
                    }}
                  >
                    {i + 1}
                  </span>
                ))}
                <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                  预计 ~30 秒
                </span>
              </div>
            )}

            {/* O-09：合盘失败重试卡片 */}
            {analysisError && !analyzing && (
              <ErrorRetryCard
                title={analysisError.title}
                detail={analysisError.detail}
                code={analysisError.code}
                onRetry={handleAnalyze}
                retrying={analyzing}
                style={{ marginTop: 16 }}
              />
            )}
          </div>

          {/* 历史合盘 */}
          {!analysis && histories.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SectionTitle icon="ti-history" title="历史合盘" />
            </div>
          )}
          {!analysis && histories.length > 0 && (
            <div className="log-list" style={{ marginTop: 12 }}>
              {histories.slice(0, 5).map((h) => (
                <button
                  key={h.id}
                  onClick={() => setAnalysis(h)}
                  className="log-item"
                  style={{
                    background: "var(--panel)",
                    cursor: "pointer",
                    border: "1px solid var(--line-light)",
                    alignItems: "center",
                  }}
                >
                  <div className="log-info">
                    <div className="log-title" style={{ fontSize: 14 }}>
                      {h.selfChart.name} <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>×</span> {h.partnerChart.name}
                    </div>
                    <div className="log-meta">{new Date(h.createdAt).toLocaleString("zh-CN")}</div>
                  </div>
                  <span className="chip">
                    <i className="ti ti-star" /> 综合 {h.result.dimensionScores.overall}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 结果 */}
          {analysis && (
            <div style={{ marginTop: 16 }}>
              <CompatibilityResultView analysis={analysis} onReset={() => setAnalysis(null)} />
            </div>
          )}
        </>
      )}
    </PageContainer>
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

  return (
    <div className="compat-result">
      {/* 头部 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 16, color: "var(--ink)", fontWeight: 600, margin: 0 }}>
            {analysis.selfChart.name} <span style={{ color: "var(--brand)", margin: "0 6px" }}>×</span> {analysis.partnerChart.name}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {new Date(analysis.createdAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {/* S-07：分享按钮 */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              const url = `${window.location.origin}/compatibility?id=${analysis.id}`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success("已复制链接，可发给好友查看");
              } catch {
                toast.error("复制失败，请手动复制：" + url);
              }
            }}
            title="复制只读链接"
          >
            <i className="ti ti-link" /> 复制链接
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onReset}>
            <i className="ti ti-refresh" /> 重新选
          </button>
        </div>
      </div>

      {/* 综合评分 + 维度 */}
      <div
        className="card"
        style={{
          marginBottom: 14,
          textAlign: "center",
          background: "linear-gradient(135deg, var(--soft), var(--panel))",
          borderColor: "var(--brand)",
        }}
      >
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>综合契合度</p>
        <div
          className={`score-pill ${scoreClass(r.dimensionScores.overall)}`}
          style={{ width: 96, height: 96, fontSize: 36, margin: "0 auto 16px", borderWidth: 3 }}
        >
          {r.dimensionScores.overall}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          {dims.map((d) => (
            <div key={d.key} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.label}</div>
              <div
                className={`score-pill ${scoreClass(r.dimensionScores[d.key])}`}
                style={{ width: 36, height: 36, fontSize: 13, marginTop: 4 }}
              >
                {r.dimensionScores[d.key]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 关键亮点 / 风险 */}
      {(r.highlights.length > 0 || r.risks.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {r.highlights.length > 0 && (
            <div
              className="card"
              style={{ background: "var(--success-soft, rgba(44,74,30,.06))", borderColor: "var(--success)", padding: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>
                <i className="ti ti-trending-up" /> 关键亮点
              </div>
              {r.highlights.map((h, i) => (
                <p key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.7, margin: "2px 0" }}>• {h}</p>
              ))}
            </div>
          )}
          {r.risks.length > 0 && (
            <div
              className="card"
              style={{ background: "var(--warning-soft, rgba(196,154,74,.08))", borderColor: "var(--warning)", padding: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--warning)", marginBottom: 6 }}>
                <i className="ti ti-alert-triangle" /> 风险提示
              </div>
              {r.risks.map((r2, i) => (
                <p key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.7, margin: "2px 0" }}>• {r2}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 四化交叉 */}
      {r.crossSihua.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionTitle icon="ti-arrows-shuffle" title="四化交叉" />
        </div>
      )}
      {r.crossSihua.length > 0 && (
        <div className="log-list" style={{ marginTop: 8 }}>
          {r.crossSihua.map((s, i) => (
            <div key={i} className="log-item" style={{ alignItems: "flex-start" }}>
              <span className="chip" style={{ ...sihuaColor(s.type), padding: "2px 10px", fontSize: 11, flexShrink: 0 }}>
                {s.from === 'self' ? '我' : '对方'}·化{s.type}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{s.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* 星曜互动 */}
      {r.starInteraction.length > 0 && (
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <SectionTitle icon="ti-stars" title="星曜互动" />
        </div>
      )}
      {r.starInteraction.length > 0 && (
        <div className="log-list" style={{ marginTop: 8 }}>
          {r.starInteraction.slice(0, 10).map((it, i) => (
            <div key={i} className="log-item" style={{ alignItems: "flex-start" }}>
              <span
                className="chip"
                style={{
                  padding: "2px 10px",
                  fontSize: 11,
                  flexShrink: 0,
                  background: it.nature === '吉' ? "var(--success-soft, rgba(44,74,30,.08))" : it.nature === '凶' ? "var(--danger-soft, rgba(139,26,26,.08))" : "var(--soft)",
                  color: it.nature === '吉' ? "var(--success)" : it.nature === '凶' ? "var(--danger)" : "var(--text-muted)",
                  border: "1px solid " + (it.nature === '吉' ? "var(--success)" : it.nature === '凶' ? "var(--danger)" : "var(--line)"),
                }}
              >
                {it.relation}·{it.nature}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{it.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* 十二宫对照 */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <SectionTitle icon="ti-layout-grid" title="十二宫对照" />
      </div>
      <div className="log-list" style={{ marginTop: 8 }}>
        {r.palaceComparison
          .filter((p) => p.harmony !== 'neutral')
          .map((p, i) => (
            <div
              key={i}
              className="log-item"
              style={{
                flexDirection: "column",
                alignItems: "stretch",
                gap: 6,
                background: p.harmony === 'harmony'
                  ? "var(--success-soft, rgba(44,74,30,.06))"
                  : "var(--danger-soft, rgba(139,26,26,.06))",
                borderColor: p.harmony === 'harmony' ? "var(--success)" : "var(--danger)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                {p.palace} {p.harmony === 'harmony' ? '✓' : '⚠'}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-light)" }}>{p.note}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                我：{p.self.stars.join('·') || '空'} <span style={{ margin: "0 4px" }}>|</span> 对方：{p.partner.stars.join('·') || '空'}
              </div>
            </div>
          ))}
        {r.palaceComparison.every((p) => p.harmony === 'neutral') && (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>十二宫能量平稳，无显著吉凶对照</p>
        )}
      </div>

      {/* AI 解读 */}
      {analysis.aiSummary && (
        <div
          className="card"
          style={{ marginTop: 14, borderColor: "var(--brand)" }}
        >
          <SectionTitle icon="ti-sparkles" title="AI 深度解读" />
          <div
            style={{
              fontSize: 14,
              color: "var(--ink-light)",
              lineHeight: 1.9,
              whiteSpace: "pre-wrap",
              marginTop: 10,
            }}
          >
            {analysis.aiSummary}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompatibilityPage() {
  return (
    <Suspense
      fallback={
        <PageContainer maxWidth={900}>
          <LoadingState title="加载合盘页面中…" description="请稍候" />
        </PageContainer>
      }
    >
      <CompatibilityContent />
    </Suspense>
  );
}
