"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Star,
  Trash2,
  FileText,
  MessageSquare,
  Crown,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface ChartSummary {
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
  summary: {
    solarDate: string;
    lunarDate: string;
    mingGongMajorStars: string[];
    shenGongName: string;
    birthGanZhi: string;
    zodiac: string;
    fiveElementsClass: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface IdentityBrief {
  id: string;
  name: string;
  gender: string;
  relation: string;
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<ChartSummary["source"], string> = {
  MANUAL: "手动",
  IMPORTED: "自动",
  CHAT: "对话",
  REPORT: "报告",
};

function timeIndexLabel(idx: number): string {
  const labels = ["子早", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子晚"];
  return labels[idx] ?? "?";
}

// ---------------------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------------------

export default function ChartsListPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();

  const [charts, setCharts] = useState<ChartSummary[]>([]);
  const [identities, setIdentities] = useState<IdentityBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ChartSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCharts = useCallback(async () => {
    try {
      const res = await fetch("/api/charts");
      if (res.ok) {
        const data = await res.json();
        setCharts(data.charts ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchIdentities = useCallback(async () => {
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.identities ?? []);
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
      Promise.all([fetchCharts(), fetchIdentities()]).finally(() => setLoading(false));
    }
  }, [sessionStatus, router, fetchCharts, fetchIdentities]);

  const handleSetPrimary = async (chart: ChartSummary) => {
    try {
      const res = await fetch(`/api/charts/${chart.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (res.ok) {
        toast.success(`已设为「${chart.identityId}」默认盘`);
        fetchCharts();
      } else {
        toast.error("设置失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/charts/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("命盘已删除");
        setDeleteTarget(null);
        fetchCharts();
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setDeleting(false);
    }
  };

  // 按命主分组
  const grouped: Record<string, { identity?: IdentityBrief; charts: ChartSummary[] }> = {};
  for (const chart of charts) {
    if (!grouped[chart.identityId]) {
      grouped[chart.identityId] = {
        identity: identities.find((i) => i.id === chart.identityId),
        charts: [],
      };
    }
    grouped[chart.identityId].charts.push(chart);
  }

  // 加载中
  if (loading) {
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
          <h1 className="font-serif-sc text-sm font-bold text-foreground">我的命盘</h1>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90"
            onClick={() => router.push("/chart")}
          >
            <Plus className="w-4 h-4 mr-1" />
            排盘
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {charts.length === 0 ? (
          <Card className="border-primary/10">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/5 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary/40" />
              </div>
              <div>
                <p className="font-serif-sc text-sm font-bold text-foreground">还没有保存的命盘</p>
                <p className="text-xs text-muted-foreground mt-1">
                  排盘后点击「保存为命盘」，可在 AI 对话、报告生成、合盘分析中复用
                </p>
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => router.push("/chart")}
              >
                <Plus className="w-4 h-4 mr-1" />
                开始排盘
              </Button>
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([identityId, group]) => (
            <div key={identityId} className="space-y-2">
              {/* 命主分组标题 */}
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {group.identity?.name ?? "未知命主"}
                </h2>
                {group.identity && (
                  <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                    {group.identity.gender === "MALE" ? "男" : "女"}
                  </Badge>
                )}
              </div>

              {/* 命盘卡片 */}
              <div className="space-y-2">
                {group.charts.map((chart) => (
                  <Card
                    key={chart.id}
                    className="border-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/charts/${chart.id}`)}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {chart.isPrimary ? (
                            <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          ) : (
                            <Star className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-foreground truncate">
                                {chart.name}
                              </span>
                              {chart.isPrimary && (
                                <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                  默认
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {SOURCE_LABELS[chart.source]}
                              </Badge>
                            </div>
                            {chart.note && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {chart.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0 text-right">
                          {new Date(chart.createdAt).toLocaleDateString("zh-CN")}
                        </div>
                      </div>

                      {/* 命盘摘要 */}
                      {chart.summary ? (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md bg-primary/5 px-2 py-1">
                            <span className="text-muted-foreground">命宫：</span>
                            <span className="text-foreground font-medium">
                              {chart.summary.mingGongMajorStars.join("·") || "空宫"}
                            </span>
                          </div>
                          <div className="rounded-md bg-primary/5 px-2 py-1">
                            <span className="text-muted-foreground">身宫：</span>
                            <span className="text-foreground font-medium">{chart.summary.shenGongName}</span>
                          </div>
                          <div className="rounded-md bg-primary/5 px-2 py-1">
                            <span className="text-muted-foreground">生年：</span>
                            <span className="text-foreground font-medium">{chart.summary.birthGanZhi}</span>
                          </div>
                          <div className="rounded-md bg-primary/5 px-2 py-1">
                            <span className="text-muted-foreground">五行局：</span>
                            <span className="text-foreground font-medium">{chart.summary.fiveElementsClass}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {chart.birthSolarDate} · {timeIndexLabel(chart.timeIndex)}时
                          {chart.birthCity ? ` · ${chart.birthCity}` : ""}
                        </div>
                      )}

                      {/* 操作 */}
                      <div className="flex items-center gap-2 pt-1 border-t border-primary/5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/charts/${chart.id}?action=chat`);
                          }}
                        >
                          <MessageSquare className="w-3 h-3 mr-1" />
                          AI 解盘
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/charts/${chart.id}?action=report`);
                          }}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          生成报告
                        </Button>
                        {!chart.isPrimary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimary(chart);
                            }}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            设默认
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 ml-auto text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(chart);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除命盘</DialogTitle>
            <DialogDescription>
              将删除「{deleteTarget?.name}」，此操作不可恢复。
              {deleteTarget?.isPrimary && " 删除默认盘后会自动选取同命主最新盘为默认。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
