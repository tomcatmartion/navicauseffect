"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
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
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b border-primary/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/charts")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => {
                setEditName(chart.name);
                setEditNote(chart.note ?? "");
                setEditOpen(true);
              }}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 头部 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {chart.isPrimary ? (
              <Crown className="w-5 h-5 text-amber-500" />
            ) : (
              <Star className="w-5 h-5 text-muted-foreground/40" />
            )}
            <h1 className="font-serif-sc text-xl font-bold text-foreground">{chart.name}</h1>
            {chart.isPrimary && (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">默认盘</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>命主：{chart.identity.name}</span>
            <span className="w-1 h-1 rounded-full bg-primary/20" />
            <span>{chart.identity.gender === "MALE" ? "男" : "女"}</span>
            <span className="w-1 h-1 rounded-full bg-primary/20" />
            <span>{SOURCE_LABELS[chart.source]}</span>
            <span className="w-1 h-1 rounded-full bg-primary/20" />
            <span>{new Date(chart.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
          {chart.note && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-primary/20 pl-2 mt-2">
              {chart.note}
            </p>
          )}
        </div>

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
