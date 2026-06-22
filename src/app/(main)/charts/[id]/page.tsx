"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  Loader2,
  Star,
  Trash2,
  FileText,
  MessageSquare,
  Heart,
  Crown,
  Edit3,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
      </div>
    );
  }

  if (!chart) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-primary/20" />
        <p className="text-muted-foreground">命盘不存在</p>
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
            <Edit3 className="size-3.5" style={{ marginRight: 4 }} />
            编辑
          </button>
          <button
            type="button"
            className="iconbtn"
            style={{ width: 32, height: 32 }}
            onClick={() => setDeleteOpen(true)}
            title="删除"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 头部 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {chart.isPrimary ? (
            <Crown className="size-5" style={{ color: "var(--warning)" }} />
          ) : (
            <Star className="size-5" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
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

      {/* Tab 切换 */}
      <div className="seg" style={{ marginBottom: 16 }}>
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
        <button
          type="button"
          className={activeTab === "analysis" ? "active" : ""}
          onClick={() => setActiveTab("analysis")}
        >
          AI 分析
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
              <Loader2
                className="size-8 animate-spin"
                style={{ color: "var(--brand)" }}
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

      {/* Tab 内容：AI 分析入口 */}
      {activeTab === "analysis" && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <i
            className="ti ti-robot"
            style={{ fontSize: 36, color: "var(--brand)" }}
          />
          <p style={{ fontWeight: 600, color: "var(--brand)", marginTop: 12 }}>
            AI 深度解读
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            跳转到 AI 对话页，针对此命盘深度提问
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() =>
              router.push(`/chart?chartRecordId=${chart.id}`)
            }
          >
            <i className="ti ti-message-2" style={{ marginRight: 6 }} />
            开始 AI 对话
          </button>
        </div>
      )}

      <div className="space-y-4" style={{ marginTop: 16 }}>

        {/* 命盘摘要 */}
        <Card className="border-primary/10">
          <CardContent className="p-4 space-y-3">
            <h2 className="font-serif-sc text-sm font-bold text-foreground">命盘摘要</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <div className="text-muted-foreground mb-0.5">阳历</div>
                <div className="font-medium">{chart.chartSnapshot.summary.solarDate}</div>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <div className="text-muted-foreground mb-0.5">阴历</div>
                <div className="font-medium">{chart.chartSnapshot.summary.lunarDate}</div>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <div className="text-muted-foreground mb-0.5">生年干支</div>
                <div className="font-medium">{chart.chartSnapshot.summary.birthGanZhi}</div>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <div className="text-muted-foreground mb-0.5">生肖 · 五行局</div>
                <div className="font-medium">
                  {chart.chartSnapshot.summary.zodiac} · {chart.chartSnapshot.summary.fiveElementsClass}
                </div>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2 col-span-2">
                <div className="text-muted-foreground mb-0.5">命宫主星</div>
                <div className="font-medium">
                  {chart.chartSnapshot.summary.mingGongMajorStars.join("、") || "空宫"}
                </div>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <div className="text-muted-foreground mb-0.5">身宫</div>
                <div className="font-medium">{chart.chartSnapshot.summary.shenGongName}</div>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <div className="text-muted-foreground mb-0.5">时辰</div>
                <div className="font-medium">
                  {timeIndexLabel(chart.timeIndex)}时
                  {chart.chartSnapshot.birthInfo.trueSolarTimeInfo && (
                    <span className="ml-1 text-muted-foreground">
                      ({chart.chartSnapshot.birthInfo.trueSolarTimeInfo})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 操作 CTA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            className="bg-primary hover:bg-primary/90 h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => router.push(`/chart?chartRecordId=${chart.id}`)}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">AI 解盘</span>
          </Button>
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5 h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => router.push(`/reports?chartRecordId=${chart.id}&identityId=${chart.identityId}`)}
          >
            <FileText className="w-5 h-5" />
            <span className="text-xs">生成报告</span>
          </Button>
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5 h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => router.push(`/compatibility?selfChartId=${chart.id}`)}
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs">加入合盘</span>
          </Button>
        </div>

        {!chart.isPrimary && (
          <Button
            variant="outline"
            className="w-full border-primary/20"
            onClick={handleSetPrimary}
          >
            <Crown className="w-4 h-4 mr-2 text-amber-500" />
            设为该命主的默认盘
          </Button>
        )}

        {/* 快照元信息（开发调试用） */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">快照元信息</summary>
          <div className="mt-2 space-y-1 pl-3">
            <div>iztroVersion: {chart.chartSnapshot.iztroVersion}</div>
            <div>computedAt: {chart.chartSnapshot.computedAt}</div>
            <div>fingerprint: {chart.chartFingerprint.slice(0, 16)}...</div>
          </div>
        </details>
      </div>

      {/* 编辑弹窗 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑命盘</DialogTitle>
            <DialogDescription>修改盘别名或备注</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">盘别名</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">备注</label>
              <Input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="如：母亲提供的是阴历"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除命盘</DialogTitle>
            <DialogDescription>将删除「{chart.name}」，此操作不可恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChartDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>}>
      <ChartDetailContent />
    </Suspense>
  );
}
