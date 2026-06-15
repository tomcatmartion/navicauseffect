"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  FileText,
  Loader2,
  Send,
  MessageSquare,
  Trash2,
  Crown,
  Star,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
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

interface ReportDetail {
  id: string;
  status: string;
  progress: number;
  content: string | null;
  coverImage: string | null;
  createdAt: string;
  errorMessage: string | null;
  /** 父报告 id（子报告场景）；主报告为 null */
  parentReportId?: string | null;
  template: { id: string; name: string; slug: string; type: string };
  identity: { id: string; name: string; gender: string };
  children: {
    id: string;
    status: string;
    progress: number;
    template: { id: string; name: string; slug: string };
  }[];
  questions: {
    id: string;
    question: string;
    answer: string | null;
    createdAt: string;
  }[];
}

/** 报告是否处于可点击查看的终态 */
function isViewable(status: string): boolean {
  return status === "COMPLETED";
}

/** 报告是否还在生成（需要继续轮询） */
function isPending(status: string): boolean {
  return status === "GENERATING" || status === "PENDING";
}

// ---------------------------------------------------------------------------
// 状态展示
// ---------------------------------------------------------------------------

function StatusDisplay({ status, progress }: { status: string; progress: number }) {
  switch (status) {
    case "COMPLETED":
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          已完成
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          生成失败
        </Badge>
      );
    case "GENERATING":
      return (
        <div className="space-y-2">
          <Badge className="bg-primary/10 text-primary border-primary/20">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            生成中 {progress}%
          </Badge>
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      );
    case "PENDING":
    default:
      return (
        <Badge className="bg-muted text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          排队中
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// 报告详情页
// ---------------------------------------------------------------------------

export default function ReportDetailPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 加载报告
  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
      } else {
        toast.error("报告不存在");
        router.push("/reports");
      }
    } catch {
      toast.error("加载报告失败");
    } finally {
      setLoading(false);
    }
  }, [reportId, router]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (sessionStatus === "authenticated" && reportId) {
      fetchReport();
    }
  }, [sessionStatus, router, reportId, fetchReport]);

  // 自动轮询生成中的报告（含子报告未完成的情况）
  useEffect(() => {
    if (!report) return;
    // 主报告已终态且无子报告，或全部子报告也已终态 → 停止轮询
    const mainDone = !isPending(report.status);
    const childrenAllDone = !report.children.some((c) => isPending(c.status));
    if (mainDone && childrenAllDone) return;

    // 总超时兜底：最多轮询 10 分钟（避免后端异常时无限轮询）
    const startedAt = Date.now();
    const MAX_POLL_MS = 10 * 60 * 1000;

    const timer = setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(timer);
        return;
      }
      fetchReport();
    }, 3000);
    return () => clearInterval(timer);
  }, [report, fetchReport]);

  // 提交问题
  const handleSubmitQuestion = async () => {
    if (!question.trim()) {
      toast.error("请输入问题");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (res.ok) {
        toast.success("问题已提交");
        setQuestion("");
        fetchReport();
      } else {
        const data = await res.json();
        toast.error(data.error || "提交失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  // 删除报告
  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("报告已删除");
        router.push("/reports");
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("网络错误");
    }
    setShowDeleteDialog(false);
  };

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-primary/20" />
        <p className="text-muted-foreground">报告不存在</p>
        <Button variant="outline" className="border-primary/30 text-primary" onClick={() => router.push("/reports")}>
          返回报告列表
        </Button>
      </div>
    );
  }

  const isCompleted = report.status === "COMPLETED";
  const isFailed = report.status === "FAILED";

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b border-primary/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              // 子报告 → 返回父报告；主报告 → 返回列表
              if (report.parentReportId) {
                router.push(`/reports/${report.parentReportId}`);
              } else {
                router.push("/reports");
              }
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {report.parentReportId ? "返回主报告" : "返回"}
          </button>
          <div className="flex items-center gap-2">
            <StatusDisplay status={report.status} progress={report.progress} />
            {isCompleted && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                title="删除报告"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 报告头部 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {report.template.type === "BASIC" ? (
              <Star className="w-5 h-5 text-primary" />
            ) : (
              <Crown className="w-5 h-5 text-primary" />
            )}
            <h1 className="font-serif-sc text-xl font-bold text-foreground">
              {report.template.name}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>命主：{report.identity.name}</span>
            <span className="w-1 h-1 rounded-full bg-primary/20" />
            <span>{new Date(report.createdAt).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>

        {/* 失败提示 */}
        {isFailed && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">报告生成失败</p>
                <p className="text-xs text-red-500 mt-1">
                  {report.errorMessage || "请稍后重试或联系客服"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 子报告状态 */}
        {report.children.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">子报告</h2>
            <div className="space-y-1.5">
              {report.children.map((child) => {
                const viewable = isViewable(child.status);
                const rowClasses = `flex w-full items-center justify-between p-3 rounded-xl border transition-colors text-left ${
                  viewable
                    ? "bg-primary/5 border-primary/10 hover:bg-primary/10 hover:border-primary/30 cursor-pointer"
                    : "bg-primary/5 border-primary/10 cursor-default"
                }`;
                const inner = (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground truncate">{child.template.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusDisplay status={child.status} progress={child.progress} />
                      {viewable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </>
                );
                if (viewable) {
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => router.push(`/reports/${child.id}`)}
                      className={rowClasses}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={child.id} className={rowClasses}>
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 报告内容 — 支持章节JSON和纯文本两种格式 */}
        {isCompleted && report.content && (() => {
          let parsed: {
            chapters?: Array<{ title: string; content?: string }>;
            content?: Array<{ paragraph: string; paragraph_id?: string; qa?: string[] }>;
            dataPanel?: {
              palaceScores: Array<{ palace: string; diZhi: string; majorStars: string[]; finalScore: number; level: string; isBodyPalace: boolean }>;
              sihuaLanding: Array<{ layer: string; type: string; star: string; palace: string }>;
              daXianTimeline: Array<{ index: number; ageRange: string; tone: string; daXianGan: string; mingPalace: string; mutagen: string[]; isCurrent: boolean }>;
              patterns: Array<{ name: string; level: string; category: string }>;
              matters: Array<{ matterType: string; primaryPalace: string; primaryScore: number; compositeScore: number; scoreLabel: string; direction: string }>;
              personalityTriad: { overallTone: string; ming: string; shen: string; taiSui: string } | null;
            };
          } | null = null;
          try {
            parsed = JSON.parse(report.content);
          } catch {
            // 纯文本格式
          }

          // 章节式内容
          if (parsed?.chapters && Array.isArray(parsed.chapters)) {
            return (
              <div className="space-y-6">
                {/* 命盘数据看板（程序生成的结构化可视化数据，确定性无幻觉） */}
                {parsed.dataPanel && (
                  <div className="rounded-xl border border-primary/15 bg-gradient-to-b from-primary/5 to-transparent p-5 space-y-4">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-serif-sc text-sm font-bold text-foreground">命盘数据看板</h3>
                      <span className="text-xs text-muted-foreground">紫微斗数程序计算 · 确定性数据</span>
                    </div>

                    {/* 性格三宫 */}
                    {parsed.dataPanel.personalityTriad && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg border border-border px-3 py-2"><span className="text-muted-foreground">命宫：</span>{parsed.dataPanel.personalityTriad.ming || '—'}</div>
                        <div className="rounded-lg border border-border px-3 py-2"><span className="text-muted-foreground">身宫：</span>{parsed.dataPanel.personalityTriad.shen || '—'}</div>
                        <div className="rounded-lg border border-border px-3 py-2"><span className="text-muted-foreground">太岁：</span>{parsed.dataPanel.personalityTriad.taiSui || '—'}</div>
                      </div>
                    )}

                    {/* 十二宫强弱 */}
                    {parsed.dataPanel.palaceScores?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-muted-foreground mb-2">十二宫强弱</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {parsed.dataPanel.palaceScores.map((p, i) => (
                            <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${p.isBodyPalace ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{p.palace}{p.isBodyPalace && <span className="text-primary ml-1">身</span>}</span>
                                <span className={`font-mono ${p.level === '强旺' ? 'text-green-600' : p.level === '偏弱' ? 'text-red-500' : 'text-muted-foreground'}`}>{p.finalScore}</span>
                              </div>
                              <div className="text-muted-foreground truncate">{p.majorStars.join('、') || '空宫'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 四化落宫 */}
                    {parsed.dataPanel.sihuaLanding?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-muted-foreground mb-2">四化落宫（原局·大限·流年）</div>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.dataPanel.sihuaLanding.map((s, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-xs border ${s.type === '禄' ? 'border-green-500/30 text-green-700 bg-green-50 dark:bg-green-950/30' : s.type === '忌' ? 'border-red-500/30 text-red-700 bg-red-50 dark:bg-red-950/30' : s.type === '权' ? 'border-amber-500/30 text-amber-700 bg-amber-50 dark:bg-amber-950/30' : 'border-blue-500/30 text-blue-700 bg-blue-50 dark:bg-blue-950/30'}`}>
                              {s.layer}·{s.type}{s.star}→{s.palace}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 大限走势 */}
                    {parsed.dataPanel.daXianTimeline?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-muted-foreground mb-2">大限十年走势</div>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.dataPanel.daXianTimeline.map((d, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-xs border ${d.isCurrent ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground'}`}>
                              {d.isCurrent && '★'}第{d.index}限({d.ageRange})·{d.mingPalace}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 格局 */}
                    {parsed.dataPanel.patterns?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-muted-foreground mb-2">命盘格局</div>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.dataPanel.patterns.map((p, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded text-xs border ${p.level.includes('吉') ? 'border-amber-500/30 text-amber-700 bg-amber-50 dark:bg-amber-950/30' : p.level.includes('凶') ? 'border-red-500/30 text-red-700 bg-red-50 dark:bg-red-950/30' : 'border-border'}`}>
                              {p.name}({p.level})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 目录导航 */}
                {parsed.chapters.length > 3 && (
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">目录</h3>
                    <div className="space-y-1">
                      {parsed.chapters.map((ch, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const el = document.getElementById(`chapter-${idx}`);
                            el?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="block w-full text-left text-sm text-foreground/70 hover:text-primary py-1 transition-colors"
                        >
                          {idx + 1}. {ch.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 章节内容 */}
                {parsed.chapters.map((chapter, idx) => (
                  <div key={idx} id={`chapter-${idx}`} className="scroll-mt-24">
                    <Card className="border-primary/10 overflow-hidden">
                      <div className="px-6 py-4 bg-primary/5 border-b border-primary/10">
                        <h2 className="font-serif-sc text-base font-bold text-foreground">
                          <span className="text-primary mr-2">{idx + 1}.</span>
                          {chapter.title}
                        </h2>
                      </div>
                      <div className="p-6 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-card">
                        {chapter.content || "内容生成中..."}
                      </div>
                    </Card>
                  </div>
                ))}

                {/* 段落级推荐问题 */}
                {parsed.content && Array.isArray(parsed.content) && parsed.content.some((p) => p.qa && p.qa.length > 0) && (
                  <div className="space-y-3">
                    <h3 className="font-serif-sc text-sm font-bold text-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      推荐问题
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {parsed.content
                        .filter((p) => p.qa && p.qa.length > 0)
                        .flatMap((p) => p.qa ?? [])
                        .slice(0, 8)
                        .map((q, i) => (
                          <button
                            key={i}
                            onClick={() => { setQuestion(q); }}
                            className="px-3 py-1.5 rounded-full border border-primary/20 bg-card text-xs text-foreground hover:border-primary hover:text-primary transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // 纯文本内容
          return (
            <Card className="border-primary/10">
              <CardContent className="p-6 leading-relaxed text-sm text-foreground/80 whitespace-pre-wrap">
                {report.content}
              </CardContent>
            </Card>
          );
        })()}

        {isCompleted && !report.content && (
          <Card className="border-primary/10">
            <CardContent className="p-8 text-center">
              <FileText className="w-10 h-10 text-primary/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">报告内容为空</p>
            </CardContent>
          </Card>
        )}

        {/* 问答区域 */}
        {isCompleted && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h2 className="font-serif-sc text-sm font-bold text-foreground">报告问答</h2>
              {report.questions.length > 0 && (
                <Badge variant="outline" className="border-primary/20 text-xs text-primary">
                  {report.questions.length}
                </Badge>
              )}
            </div>

            {/* 已有问题 */}
            {report.questions.length > 0 && (
              <div className="space-y-3">
                {report.questions.map((q) => (
                  <Card key={q.id} className="border-primary/10">
                    <CardContent className="p-4 space-y-2">
                      <div className="text-sm font-medium text-foreground">
                        Q: {q.question}
                      </div>
                      {q.answer ? (
                        <div className="text-sm text-muted-foreground pl-3 border-l-2 border-primary/30">
                          {q.answer}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/10 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          AI 正在回答...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 提交问题 */}
            <div className="flex gap-2">
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="对报告有疑问？输入问题..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitQuestion();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleSubmitQuestion}
                disabled={submitting || !question.trim()}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 生成中的提示 */}
        {(report.status === "GENERATING" || report.status === "PENDING") && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="font-serif-sc text-sm font-medium text-foreground">
                报告正在生成中...
              </p>
              <p className="text-xs text-muted-foreground">
                系统正在基于命盘数据生成分析报告，请耐心等待
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，子报告和相关问答也将一并删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
