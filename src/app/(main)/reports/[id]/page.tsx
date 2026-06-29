"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

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

function isViewable(status: string): boolean {
  return status === "COMPLETED";
}

function isPending(status: string): boolean {
  return status === "GENERATING" || status === "PENDING";
}

// ---------------------------------------------------------------------------
// 状态展示
// ---------------------------------------------------------------------------

const statusChipStyle = (bg: string, color: string): CSSProperties => ({
  background: bg,
  color,
  border: "1px solid " + color,
  padding: "2px 10px",
  fontSize: 11,
  borderRadius: 100,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontWeight: 500,
});

function StatusDisplay({ status, progress }: { status: string; progress: number }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span style={statusChipStyle("var(--success-soft, rgba(44,74,30,.08))", "var(--success)")}>
          <i className="ti ti-circle-check" /> 已完成
        </span>
      );
    case "FAILED":
      return (
        <span style={statusChipStyle("var(--danger-soft, rgba(139,26,26,.08))", "var(--danger)")}>
          <i className="ti ti-x" /> 生成失败
        </span>
      );
    case "GENERATING": {
      // S-05：3 阶段精细化文案（<40% 排盘解析 / 40-80% AI 校对 / >80% 即将完成）
      const phaseText =
        progress < 40 ? "正在排盘解析" : progress < 80 ? "AI 校对中" : "即将完成";
      return (
        <div>
          <span style={statusChipStyle("var(--soft)", "var(--brand)")}>
            <i className="ti ti-loader-2 ti-spin" /> {phaseText} · {progress}%
          </span>
          <div className="dim-track" style={{ height: 4, marginTop: 6 }}>
            <div
              className="dim-fill"
              style={{ width: `${progress}%`, background: "var(--brand)" }}
            />
          </div>
        </div>
      );
    }
    case "PENDING":
    default:
      return (
        <span style={statusChipStyle("var(--soft)", "var(--text-muted)")}>
          <i className="ti ti-clock" /> 排队中
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// 工具：四化颜色
// ---------------------------------------------------------------------------

function sihuaStyle(type: string): CSSProperties {
  switch (type) {
    case "禄":
      return { background: "var(--success-soft, rgba(44,74,30,.08))", color: "var(--success)", border: "1px solid var(--success)" };
    case "忌":
      return { background: "var(--danger-soft, rgba(139,26,26,.08))", color: "var(--danger)", border: "1px solid var(--danger)" };
    case "权":
      return { background: "var(--warning-soft, rgba(196,154,74,.1))", color: "var(--warning)", border: "1px solid var(--warning)" };
    case "科":
    default:
      return { background: "var(--soft)", color: "var(--brand)", border: "1px solid var(--brand)" };
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

  useEffect(() => {
    if (!report) return;
    const mainDone = !isPending(report.status);
    const childrenAllDone = !report.children.some((c) => isPending(c.status));
    if (mainDone && childrenAllDone) return;

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

  if (loading) {
    return (
      <PageContainer maxWidth={900}>
        <EmptyState icon="ti-loader-2" title="加载中…" />
      </PageContainer>
    );
  }

  if (!report) {
    return (
      <PageContainer maxWidth={900}>
        <EmptyState
          icon="ti-alert-circle"
          title="报告不存在"
          description="可能已被删除或链接错误"
        >
          <button className="btn btn-primary" onClick={() => router.push("/reports")}>
            <i className="ti ti-arrow-left" /> 返回报告列表
          </button>
        </EmptyState>
      </PageContainer>
    );
  }

  const isCompleted = report.status === "COMPLETED";
  const isFailed = report.status === "FAILED";

  // 解析报告内容（章节式或纯文本）
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

  if (isCompleted && report.content) {
    try {
      parsed = JSON.parse(report.content);
    } catch {
      // 纯文本格式
    }
  }

  return (
    <PageContainer maxWidth={900}>
      {/* 操作栏 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (report.parentReportId) {
              router.push(`/reports/${report.parentReportId}`);
            } else {
              router.push("/reports");
            }
          }}
        >
          <i className="ti ti-arrow-left" /> {report.parentReportId ? "返回主报告" : "返回列表"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDisplay status={report.status} progress={report.progress} />
          {isCompleted && (
            <button
              className="iconbtn"
              style={{ width: 32, height: 32, color: "var(--danger)" }}
              onClick={() => setShowDeleteDialog(true)}
              title="删除报告"
            >
              <i className="ti ti-trash" />
            </button>
          )}
        </div>
      </div>

      {/* 报告头部 */}
      <div className="report-sec">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <i
            className={`ti ${report.template.type === "BASIC" ? "ti-star" : "ti-crown"}`}
            style={{ color: "var(--brand)", fontSize: 20 }}
          />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            {report.template.name}
          </h1>
          {/* O-13：报告操作按钮（已完成才显示） */}
          {isCompleted && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm no-print"
                onClick={() => {
                  const summary = parsed?.chapters
                    ?.map((c: { title?: string; content?: string }) =>
                      c.title ? `## ${c.title}\n${c.content ?? ""}` : c.content ?? "",
                    )
                    .join("\n\n") ?? "";
                  navigator.clipboard.writeText(
                    `${report.template.name}\n命主：${report.identity.name}\n\n${summary}`,
                  );
                  toast.success("报告摘要已复制到剪贴板");
                }}
                title="复制摘要"
              >
                <i className="ti ti-copy" /> 复制
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm no-print"
                onClick={() => window.print()}
                title="打印 / 另存为 PDF"
              >
                <i className="ti ti-printer" /> 打印
              </button>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          <span>命主：{report.identity.name}</span>
          <span>·</span>
          <span>{new Date(report.createdAt).toLocaleDateString("zh-CN")}</span>
        </div>
      </div>

      {/* 失败提示 */}
      {isFailed && (
        <div
          className="card"
          style={{
            background: "var(--danger-soft, rgba(139,26,26,.06))",
            borderColor: "var(--danger)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginTop: 14,
          }}
        >
          <i className="ti ti-x" style={{ color: "var(--danger)", fontSize: 20, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)", margin: 0 }}>报告生成失败</p>
            <p style={{ fontSize: 12, color: "var(--ink-light)", marginTop: 4, marginBottom: 8 }}>
              {report.errorMessage || "请稍后重试或联系客服"}
            </p>
            {/* O-19：失败态重试 CTA */}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={async () => {
                  // 优先尝试用本地缓存的生成参数直接重试
                  const raw = typeof window !== "undefined" ? localStorage.getItem(`zw-report-params-${report.id}`) : null;
                  if (raw) {
                    try {
                      const params = JSON.parse(raw) as {
                        templateId: string;
                        identityId: string;
                        chartRecordId: string;
                        extraInfo?: string;
                      };
                      const res = await fetch("/api/reports", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(params),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        toast.success("报告已重新生成");
                        if (data.report?.id) {
                          router.push(`/reports/${data.report.id}`);
                        } else {
                          router.refresh();
                        }
                        return;
                      }
                      const err = await res.json().catch(() => ({}));
                      toast.error(err.error || "重试失败");
                    } catch {
                      toast.error("网络错误，请重试");
                    }
                    return;
                  }
                  // 无缓存参数：跳回模板列表，预选原命主
                  const params = new URLSearchParams({
                    tab: "generate",
                    identityId: report.identity.id,
                    templateId: report.template.id,
                  });
                  router.push(`/reports?${params.toString()}`);
                }}
              >
                <i className="ti ti-refresh" /> 重新生成
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => router.push("/reports")}
              >
                返回模板
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 子报告 */}
      {report.children.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionTitle icon="ti-list" title="子报告" />
        </div>
      )}
      {report.children.length > 0 && (
        <div className="log-list" style={{ marginTop: 10 }}>
          {report.children.map((child) => {
            const viewable = isViewable(child.status);
            const content = (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <i className="ti ti-file-text" style={{ color: "var(--brand)", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {child.template.name}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <StatusDisplay status={child.status} progress={child.progress} />
                  {viewable && <i className="ti ti-chevron-right" style={{ color: "var(--text-muted)", fontSize: 14 }} />}
                </div>
              </>
            );
            if (viewable) {
              return (
                <button
                  key={child.id}
                  onClick={() => router.push(`/reports/${child.id}`)}
                  className="log-item"
                  style={{
                    cursor: "pointer",
                    alignItems: "center",
                    background: "var(--soft)",
                  }}
                >
                  {content}
                </button>
              );
            }
            return (
              <div key={child.id} className="log-item" style={{ alignItems: "center", background: "var(--soft)" }}>
                {content}
              </div>
            );
          })}
        </div>
      )}

      {/* 章节式内容 */}
      {isCompleted && parsed?.chapters && Array.isArray(parsed.chapters) && (
        <>
          {/* 命盘数据看板 */}
          {parsed.dataPanel && (
            <div
              className="card"
              style={{ marginTop: 20, background: "linear-gradient(to bottom, var(--soft), var(--panel))" }}
            >
              <SectionTitle icon="ti-chart-bar" title="命盘数据看板" />
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 12px" }}>
                紫微斗数程序计算 · 确定性数据
              </p>

              {/* 性格三宫 */}
              {parsed.dataPanel.personalityTriad && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12 }}>
                  {[
                    { label: "命宫", value: parsed.dataPanel.personalityTriad.ming },
                    { label: "身宫", value: parsed.dataPanel.personalityTriad.shen },
                    { label: "太岁", value: parsed.dataPanel.personalityTriad.taiSui },
                  ].map((it) => (
                    <div
                      key={it.label}
                      style={{ borderRadius: "var(--radius-sm)", border: "1px solid var(--line-light)", padding: "8px 12px" }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>{it.label}：</span>
                      <span style={{ color: "var(--ink)" }}>{it.value || "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 十二宫强弱 */}
              {parsed.dataPanel.palaceScores?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                    十二宫强弱
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                    {parsed.dataPanel.palaceScores.map((p, i) => (
                      <div
                        key={i}
                        className="card"
                        style={{
                          padding: "8px 12px",
                          borderColor: p.isBodyPalace ? "var(--brand)" : "var(--line-light)",
                          background: p.isBodyPalace ? "var(--soft)" : "var(--panel)",
                          boxShadow: "none",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 500, color: "var(--ink)" }}>
                            {p.palace}
                            {p.isBodyPalace && <span style={{ color: "var(--brand)", marginLeft: 4 }}>身</span>}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-mono, monospace)",
                              color: p.level === "强旺" ? "var(--success)" : p.level === "偏弱" ? "var(--danger)" : "var(--text-muted)",
                            }}
                          >
                            {p.finalScore}
                          </span>
                        </div>
                        <div style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.majorStars.join("、") || "空宫"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 四化落宫 */}
              {parsed.dataPanel.sihuaLanding?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                    四化落宫（原局·大限·流年）
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {parsed.dataPanel.sihuaLanding.map((s, i) => (
                      <span key={i} style={{ ...sihuaStyle(s.type), padding: "2px 8px", fontSize: 11, borderRadius: 4 }}>
                        {s.layer}·{s.type}{s.star}→{s.palace}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 大限走势 */}
              {parsed.dataPanel.daXianTimeline?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                    大限十年走势
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {parsed.dataPanel.daXianTimeline.map((d, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          border: "1px solid " + (d.isCurrent ? "var(--brand)" : "var(--line)"),
                          background: d.isCurrent ? "var(--soft)" : "var(--panel)",
                          color: d.isCurrent ? "var(--brand)" : "var(--text-muted)",
                          fontWeight: d.isCurrent ? 600 : 400,
                        }}
                      >
                        {d.isCurrent && "★"}第{d.index}限({d.ageRange})·{d.mingPalace}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 格局 */}
              {parsed.dataPanel.patterns?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
                    命盘格局
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {parsed.dataPanel.patterns.map((p, i) => {
                      const isJi = p.level.includes("吉");
                      const isXiong = p.level.includes("凶");
                      return (
                        <span
                          key={i}
                          style={{
                            padding: "2px 8px",
                            fontSize: 11,
                            borderRadius: 4,
                            background: isJi ? "var(--warning-soft, rgba(196,154,74,.1))" : isXiong ? "var(--danger-soft, rgba(139,26,26,.08))" : "var(--soft)",
                            color: isJi ? "var(--warning)" : isXiong ? "var(--danger)" : "var(--text-muted)",
                            border: "1px solid " + (isJi ? "var(--warning)" : isXiong ? "var(--danger)" : "var(--line)"),
                          }}
                        >
                          {p.name}({p.level})
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* S-16：桌面端左侧 sticky 章节目录 + 移动端折叠 select */}
          <div
            className="report-with-toc"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 18,
              marginTop: 14,
            }}
          >
            {parsed.chapters.length > 3 && (
              <aside
                className="report-toc"
                style={{
                  order: 0,
                  background: "var(--soft)",
                  border: "1px solid var(--line-light)",
                  borderRadius: "var(--radius-sm)",
                  padding: 14,
                }}
              >
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    letterSpacing: "0.1em",
                    marginBottom: 8,
                  }}
                >
                  章节目录
                </h3>
                <div className="log-list" style={{ gap: 2 }}>
                  {parsed.chapters.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const el = document.getElementById(`chapter-${idx}`);
                        el?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        padding: "4px 0",
                        fontSize: 13,
                        color: "var(--ink-light)",
                        cursor: "pointer",
                      }}
                    >
                      {idx + 1}. {ch.title}
                    </button>
                  ))}
                </div>
              </aside>
            )}

            {/* 章节内容 */}
            <div className="report-chapters">
              {parsed.chapters.map((chapter, idx) => (
                <div key={idx} id={`chapter-${idx}`} className="report-sec" style={{ marginTop: 14, scrollMarginTop: 80 }}>
                  <h4>
                    <span style={{ color: "var(--brand)", marginRight: 6 }}>{idx + 1}.</span>
                    {chapter.title}
                  </h4>
                  <p style={{ whiteSpace: "pre-wrap" }}>{chapter.content || "内容生成中..."}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 推荐问题 */}
          {parsed.content && Array.isArray(parsed.content) && parsed.content.some((p) => p.qa && p.qa.length > 0) && (
            <div style={{ marginTop: 20 }}>
              <SectionTitle icon="ti-message-2" title="推荐问题" />
            </div>
          )}
          {parsed.content && Array.isArray(parsed.content) && parsed.content.some((p) => p.qa && p.qa.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {parsed.content
                .filter((p) => p.qa && p.qa.length > 0)
                .flatMap((p) => p.qa ?? [])
                .slice(0, 8)
                .map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setQuestion(q)}
                    className="chip"
                  >
                    {q}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {/* 纯文本内容 */}
      {isCompleted && report.content && !parsed?.chapters && (
        <div className="card" style={{ marginTop: 20, lineHeight: 1.9, fontSize: 14, color: "var(--ink-light)", whiteSpace: "pre-wrap" }}>
          {report.content}
        </div>
      )}

      {/* 空内容 */}
      {isCompleted && !report.content && (
        <div className="card" style={{ marginTop: 14 }}>
          <EmptyState icon="ti-file-text" title="报告内容为空" />
        </div>
      )}

      {/* 问答区 */}
      {isCompleted && (
        <div style={{ marginTop: 24 }}>
          <SectionTitle
            icon="ti-message-2"
            title="报告问答"
            extra={
              report.questions.length > 0 ? (
                <span className="chip" style={{ fontSize: 11 }}>{report.questions.length}</span>
              ) : undefined
            }
          />
        </div>
      )}
      {isCompleted && (
        <>
          {report.questions.length > 0 && (
            <div className="log-list" style={{ marginTop: 10 }}>
              {report.questions.map((q) => (
                <div key={q.id} className="log-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                    Q: {q.question}
                  </div>
                  {q.answer ? (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--ink-light)",
                        paddingLeft: 12,
                        borderLeft: "2px solid var(--brand)",
                        lineHeight: 1.8,
                      }}
                    >
                      {q.answer}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        paddingLeft: 12,
                        borderLeft: "2px solid var(--line)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <i className="ti ti-loader-2 ti-spin" />
                      AI 正在回答...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 提交问题 */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <input
              className="input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="对报告有疑问？输入问题..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitQuestion();
                }
              }}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSubmitQuestion}
              disabled={submitting || !question.trim()}
              style={{ opacity: submitting || !question.trim() ? 0.6 : 1 }}
            >
              {submitting ? (
                <i className="ti ti-loader-2 ti-spin" />
              ) : (
                <i className="ti ti-send" />
              )}
            </button>
          </div>
        </>
      )}

      {/* 生成中提示 */}
      {(report.status === "GENERATING" || report.status === "PENDING") && (
        <div className="card" style={{ marginTop: 20, textAlign: "center", borderColor: "var(--brand)" }}>
          <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: "var(--brand)", display: "block", marginBottom: 10 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
            报告正在生成中...
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            系统正在基于命盘数据生成分析报告，请耐心等待
          </p>
        </div>
      )}

      {/* 删除确认 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="paywall-dialog">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              删除后无法恢复，子报告和相关问答也将一并删除。
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteDialog(false)}>
              取消
            </button>
            <button
              className="btn btn-sm"
              onClick={handleDelete}
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              <i className="ti ti-trash" /> 确认删除
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
