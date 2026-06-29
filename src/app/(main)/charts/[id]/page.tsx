"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { addRecentChart } from "@/lib/utils/recent-charts";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { IFunctionalAstrolabe } from "iztro/lib/astro/FunctionalAstrolabe";

// 命盘方阵（重型 iztro 依赖，dynamic 加载）
const ZwChartGrid = dynamic(
  () => import("@/components/chart/zw-chart-grid").then((m) => m.ZwChartGrid),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ChartDetail {
  id: string;
  identityId: string;
  name: string;
  birthSolarDate: string;
  birthCity: string | null;
  timeIndex: number;
  gender: "MALE" | "FEMALE";
  isPrimary: boolean;
  source: "MANUAL" | "IMPORTED" | "CHAT" | "REPORT";
  note: string | null;
  chartFingerprint: string;
  chartSnapshot: {
    iztroVersion: string;
    computedAt: string;
    birthInfo: {
      gender: "MALE" | "FEMALE";
      year: number;
      month: number;
      day: number;
      hour: number;
      solar: boolean;
      trueSolarTimeInfo?: string;
    };
    summary: {
      solarDate: string;
      lunarDate: string;
      mingGongMajorStars: string[];
      shenGongName: string;
      birthGanZhi: string;
      zodiac: string;
      fiveElementsClass: string;
    };
  };
  identity: {
    id: string;
    name: string;
    gender: string;
    birthday: string;
    relation: string;
  };
  createdAt: string;
  updatedAt: string;
}

function timeIndexLabel(idx: number): string {
  const labels = ["子早", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子晚"];
  return labels[idx] ?? "?";
}

const SOURCE_LABELS = {
  MANUAL: "手动保存",
  IMPORTED: "系统沉淀",
  CHAT: "对话生成",
  REPORT: "报告生成",
};

// ---------------------------------------------------------------------------
// 详情主体（用 useSearchParams 需 Suspense）
// ---------------------------------------------------------------------------

function ChartDetailContent() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chartId = params.id as string;
  const initialAction = searchParams.get("action"); // chat | report

  const [chart, setChart] = useState<ChartDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [astrolabe, setAstrolabe] = useState<IFunctionalAstrolabe | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "summary" | "analysis">("grid");

  // chart 加载后，用 birthInfo 重建 iztro astrolabe 实例（用于 ZwChartGrid）
  useEffect(() => {
    if (!chart?.chartSnapshot?.birthInfo) return;
    (async () => {
      try {
        const { astro } = await import("iztro");
        const bi = chart.chartSnapshot.birthInfo;
        const dateStr = `${bi.year}-${String(bi.month).padStart(2, "0")}-${String(bi.day).padStart(2, "0")}`;
        const result = astro.bySolar(
          dateStr,
          bi.hour,
          bi.gender === "MALE" ? "男" : "女",
          true,
          "zh-CN",
        );
        setAstrolabe(result);
      } catch (e) {
        console.warn("iztro astrolabe 重建失败:", e);
      }
    })();
  }, [chart]);

  const fetchChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/charts/${chartId}`);
      if (res.ok) {
        const data = await res.json();
        setChart(data.chart);
      } else if (res.status === 404) {
        toast.error("命盘不存在");
        router.push("/charts");
      }
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [chartId, router]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (sessionStatus === "authenticated") {
      fetchChart();
    }
  }, [sessionStatus, router, fetchChart]);

  // 如果 URL 带 action=chat/report，自动跳转对话/报告页（带 chartRecordId 参数）
  useEffect(() => {
    if (!chart || !initialAction) return;
    if (initialAction === "chat") {
      router.push(`/chart?chartRecordId=${chart.id}`);
    } else if (initialAction === "report") {
      router.push(`/reports?chartRecordId=${chart.id}&identityId=${chart.identityId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, initialAction]);

  // S-06：记录到「最近访问」
  useEffect(() => {
    if (!chart) return;
    addRecentChart({
      id: chart.id,
      name: chart.name,
      identityName: chart.identity?.name,
    });
  }, [chart]);

  const handleSaveEdit = async () => {
    if (!chart) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/charts/${chart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, note: editNote }),
      });
      if (res.ok) {
        toast.success("已更新");
        setEditOpen(false);
        fetchChart();
      } else {
        toast.error("更新失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimary = async () => {
    if (!chart) return;
    try {
      const res = await fetch(`/api/charts/${chart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (res.ok) {
        toast.success("已设为默认盘");
        fetchChart();
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleDelete = async () => {
    if (!chart) return;
    try {
      const res = await fetch(`/api/charts/${chart.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("已删除");
        router.push("/charts");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: "var(--brand)" }} />
      </div>
    );
  }

  if (!chart) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, minHeight: 400 }}>
        <i className="ti ti-alert-circle" style={{ fontSize: 48, color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-muted)" }}>命盘不存在</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px" }}>
      {/* 操作栏（rail+topbar 已有，不再 sticky） */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => router.push("/charts")}
        >
          <i className="ti ti-arrow-left" style={{ marginRight: 4 }} />
          返回列表
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setEditName(chart.name);
              setEditNote(chart.note ?? "");
              setEditOpen(true);
            }}
          >
            <i className="ti ti-edit" style={{ marginRight: 4 }} />
            编辑
          </button>
          <button
            type="button"
            className="iconbtn"
            style={{ width: 32, height: 32 }}
            onClick={() => setDeleteOpen(true)}
            title="删除"
          >
            <i className="ti ti-trash" />
          </button>
        </div>
      </div>

      {/* 头部 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {chart.isPrimary ? (
            <i className="ti ti-crown" style={{ fontSize: 20, color: "var(--warning)" }} />
          ) : (
            <i className="ti ti-star" style={{ fontSize: 20, color: "var(--text-muted)", opacity: 0.4 }} />
          )}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--brand)",
              fontFamily: "var(--font-head)",
              margin: 0,
            }}
          >
            {chart.name}
          </h1>
          {chart.isPrimary && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                background: "var(--brand)",
                color: "#fff",
                borderRadius: "var(--radius-sm)",
              }}
            >
              命主默认盘
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-muted)",
            flexWrap: "wrap",
            marginTop: 6,
          }}
        >
          <span>命主：{chart.identity.name}</span>
          <span>·</span>
          <span>{chart.identity.gender === "MALE" ? "男" : "女"}</span>
          <span>·</span>
          <span>{SOURCE_LABELS[chart.source]}</span>
          <span>·</span>
          <span>{new Date(chart.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
        {chart.note && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              fontStyle: "italic",
              borderLeft: "2px solid var(--brand)",
              paddingLeft: 8,
              marginTop: 8,
            }}
          >
            {chart.note}
          </p>
        )}
      </div>

      {/* Tab 切换 + C-07：移除 AI 分析 Tab，改为右侧大 CTA */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="seg" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <button
            type="button"
            className={activeTab === "grid" ? "active" : ""}
            onClick={() => setActiveTab("grid")}
          >
            命盘方阵
          </button>
          <button
            type="button"
            className={activeTab === "summary" ? "active" : ""}
            onClick={() => setActiveTab("summary")}
          >
            基本信息
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => router.push(`/chart?chartRecordId=${chart.id}`)}
          style={{ height: 36, padding: "0 16px" }}
          title="向 AI 提问关于这张命盘的任何问题"
        >
          <i className="ti ti-message-2" style={{ marginRight: 6 }} />
          AI 对话
        </button>
      </div>

      {/* Tab 内容：命盘方阵 */}
      {activeTab === "grid" && (
        <div className="card" style={{ padding: 16 }}>
          {astrolabe ? (
            <ZwChartGrid
              astrolabe={astrolabe}
              nativeName={chart.identity.name}
              lifePalaceEarthlyBranch={
                (astrolabe as unknown as { earthlyBranchOfSoulPalace?: string })
                  .earthlyBranchOfSoulPalace
              }
            />
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <i
                className="ti ti-loader-2 ti-spin"
                style={{ fontSize: 28, color: "var(--brand)" }}
              />
              <p style={{ marginTop: 12, fontSize: 12 }}>
                正在重建 iztro 命盘实例...
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 内容：基本信息（保留原 Card 内容） */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {/* 原命盘摘要 Card 等内容继续在下方渲染（不删除原结构） */}
        </div>
      )}

      {/* C-07：原 AI 分析 Tab 内容已移除，由 Tab bar 右侧 CTA 按钮替代 */}

      <div className="space-y-4" style={{ marginTop: 16 }}>

        {/* 命盘摘要 */}
        <div className="card" style={{ padding: 16 }}>
          <h2 className="home-section-title" style={{ fontSize: 14, marginBottom: 12 }}>命盘摘要</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>阳历</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>{chart.chartSnapshot.summary.solarDate}</div>
            </div>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>阴历</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>{chart.chartSnapshot.summary.lunarDate}</div>
            </div>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>生年干支</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>{chart.chartSnapshot.summary.birthGanZhi}</div>
            </div>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>生肖 · 五行局</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                {chart.chartSnapshot.summary.zodiac} · {chart.chartSnapshot.summary.fiveElementsClass}
              </div>
            </div>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px", gridColumn: "span 2" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>命宫主星</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                {chart.chartSnapshot.summary.mingGongMajorStars.join("、") || "空宫"}
              </div>
            </div>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>身宫</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>{chart.chartSnapshot.summary.shenGongName}</div>
            </div>
            <div style={{ background: "var(--soft)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ color: "var(--text-muted)", marginBottom: 2 }}>时辰</div>
              <div style={{ fontWeight: 500, color: "var(--ink)" }}>
                {timeIndexLabel(chart.timeIndex)}时
                {chart.chartSnapshot.birthInfo.trueSolarTimeInfo && (
                  <span style={{ marginLeft: 4, color: "var(--text-muted)" }}>
                    ({chart.chartSnapshot.birthInfo.trueSolarTimeInfo})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 操作 CTA */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <button
            className="btn btn-primary"
            style={{ flexDirection: "column", gap: 4, padding: "12px 8px", height: "auto" }}
            onClick={() => router.push(`/chart?chartRecordId=${chart.id}`)}
          >
            <i className="ti ti-message-2" style={{ fontSize: 18 }} />
            <span style={{ fontSize: 12 }}>AI 对话</span>
          </button>
          <button
            className="btn btn-ghost"
            style={{ flexDirection: "column", gap: 4, padding: "12px 8px", height: "auto" }}
            onClick={() => router.push(`/reports?chartRecordId=${chart.id}&identityId=${chart.identityId}`)}
          >
            <i className="ti ti-file-text" style={{ fontSize: 18 }} />
            <span style={{ fontSize: 12 }}>生成报告</span>
          </button>
          <button
            className="btn btn-ghost"
            style={{ flexDirection: "column", gap: 4, padding: "12px 8px", height: "auto" }}
            onClick={() => router.push(`/compatibility?selfChartId=${chart.id}`)}
          >
            <i className="ti ti-heart" style={{ fontSize: 18 }} />
            <span style={{ fontSize: 12 }}>加入合盘</span>
          </button>
        </div>

        {!chart.isPrimary && (
          <button
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={handleSetPrimary}
          >
            <i className="ti ti-crown" style={{ marginRight: 6, color: "var(--warning)" }} />
            设为该命主的默认盘
          </button>
        )}

        {/* 快照元信息（开发调试用） */}
        <details style={{ fontSize: 12, color: "var(--text-muted)" }}>
          <summary style={{ cursor: "pointer" }}>快照元信息</summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, paddingLeft: 12 }}>
            <div>iztroVersion: {chart.chartSnapshot.iztroVersion}</div>
            <div>computedAt: {chart.chartSnapshot.computedAt}</div>
            <div>fingerprint: {chart.chartFingerprint.slice(0, 16)}...</div>
          </div>
        </details>
      </div>

      {/* 编辑弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="paywall-dialog" style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>编辑命盘</DialogTitle>
            <DialogDescription>修改盘别名或备注</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>盘别名</label>
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>备注</label>
              <input
                className="input"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="如：母亲提供的是阴历"
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(false)} disabled={saving}>
              取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
              {saving && <i className="ti ti-loader-2 ti-spin" style={{ marginRight: 4 }} />}
              保存
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="paywall-dialog" style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>确认删除命盘</DialogTitle>
            <DialogDescription>将删除「{chart.name}」，此操作不可恢复。</DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="btn btn-sm"
              onClick={handleDelete}
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              <i className="ti ti-trash" style={{ marginRight: 4 }} />
              确认删除
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChartDetailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: "var(--brand)" }} />
        </div>
      }
    >
      <ChartDetailContent />
    </Suspense>
  );
}
