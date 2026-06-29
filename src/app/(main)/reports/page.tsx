"use client";

import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { useRequirePhoneBinding } from "@/lib/auth/use-require-phone-binding";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import { usePaywall } from "@/components/shared/paywall-dialog";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

interface TemplateChild {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "BASIC" | "ADVANCED";
  tags: string[];
  bgImage: string | null;
  pointCost: number;
  children: TemplateChild[];
}

interface Identity {
  id: string;
  name: string;
  gender: string;
  birthday: string;
  relation: string;
  isActive: boolean;
}

interface ChildReport {
  id: string;
  status: string;
  progress: number;
  template: { id: string; name: string; slug: string };
}

interface Report {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
  template: { id: string; name: string; slug: string; type: string };
  identity: { id: string; name: string; gender: string };
  children: ChildReport[];
}

interface GroupedReports {
  identity: { id: string; name: string; gender: string };
  reports: Report[];
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

const HIGHLIGHT_TAGS = new Set(["热门", "推荐", "限时", "重磅"]);

function getStatusConfig(status: string): {
  label: string;
  color: CSSProperties;
  bg: CSSProperties["background"];
  pulse: boolean;
} {
  switch (status) {
    case "COMPLETED":
      return {
        label: "已完成",
        color: { color: "var(--success)" },
        bg: "var(--success-soft, rgba(44,74,30,.08))",
        pulse: false,
      };
    case "FAILED":
      return {
        label: "失败",
        color: { color: "var(--danger)" },
        bg: "var(--danger-soft, rgba(139,26,26,.08))",
        pulse: false,
      };
    case "GENERATING":
      return {
        label: "生成中",
        color: { color: "var(--brand)" },
        bg: "var(--soft)",
        pulse: true,
      };
    case "PENDING":
    default:
      return {
        label: "等待中",
        color: { color: "var(--text-muted)" },
        bg: "var(--soft)",
        pulse: false,
      };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// 子组件：模板卡片
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: ReportTemplate;
  onSelect: (t: ReportTemplate) => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const isAdvanced = template.type === "ADVANCED";
  const highlightTags = template.tags.filter((t) => HIGHLIGHT_TAGS.has(t));
  const infoTags = template.tags.filter((t) => !HIGHLIGHT_TAGS.has(t));

  return (
    <div
      className="report-card vertical"
      style={{ cursor: "pointer" }}
      onClick={() => onSelect(template)}
      role="button"
      tabIndex={0}
    >
      {/* 封面 */}
      <div
        className="report-thumb"
        style={
          template.bgImage
            ? {
                backgroundImage: `url(${template.bgImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!template.bgImage && (
          <i className={`ti ${isAdvanced ? "ti-crown" : "ti-star"}`} style={{ fontSize: 32 }} />
        )}
        {/* 类型标记 */}
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            color: isAdvanced ? "#fff" : "var(--brand)",
            background: isAdvanced ? "var(--brand)" : "var(--panel)",
            border: "1px solid " + (isAdvanced ? "var(--brand)" : "var(--line)"),
            borderRadius: 4,
          }}
        >
          <i className={`ti ${isAdvanced ? "ti-crown" : "ti-star"}`} style={{ fontSize: 11 }} />
          {isAdvanced ? "深度" : "体验"}
        </span>
      </div>

      {/* 信息 */}
      <div className="report-info">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <h3 className="report-name" style={{ flex: 1 }}>
            {template.name}
          </h3>
          {highlightTags.map((tag) => (
            <span
              key={tag}
              style={{
                background: "var(--warning)",
                color: "#fff",
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {template.children.length > 0 && (
          <div className="report-meta">
            {template.children.map((child) => (
              <span key={child.id} className="chip">{child.name}</span>
            ))}
          </div>
        )}

        {template.description && (
          <p className="report-desc">{template.description}</p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {infoTags.map((tag) => (
              <span key={tag} style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {tag}
              </span>
            ))}
          </div>
          <div className="report-actions" style={{ flexDirection: "row" }}>
            {template.pointCost > 0 ? (
              <span className="report-cost">
                {template.pointCost}<span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 11, marginLeft: 2 }}> 星币</span>
              </span>
            ) : (
              <span className="report-cost free">免费</span>
            )}
            <i className="ti ti-chevron-right" style={{ color: "var(--text-muted)", fontSize: 14 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件：报告列表项
// ---------------------------------------------------------------------------

interface ReportItemProps {
  report: Report;
}

function ReportItem({ report }: ReportItemProps) {
  const router = useRouter();
  const statusCfg = getStatusConfig(report.status);

  const handleClick = () => {
    if (report.status === "COMPLETED") {
      router.push(`/reports/${report.id}`);
    } else if (report.status === "GENERATING") {
      toast.info("报告生成中，请稍后再查看");
    } else if (report.status === "FAILED") {
      toast.error("报告生成失败，请重试");
    } else {
      toast.info("报告正在排队中，请耐心等待");
    }
  };

  return (
    <div
      className="log-item"
      style={{
        cursor: "pointer",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* 头部 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "var(--soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand)",
            }}
          >
            <i className="ti ti-file-text" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            {report.template.name}
          </span>
        </div>
        <span
          className="chip"
          style={{
            background: statusCfg.bg,
            border: "1px solid var(--line-light)",
            padding: "2px 10px",
            fontSize: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {statusCfg.pulse && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand)",
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
          )}
          <span style={statusCfg.color}>{statusCfg.label}</span>
        </span>
      </div>

      {/* 进度条 */}
      {(report.status === "GENERATING" || report.status === "PENDING") && (
        <div className="dim-track" style={{ height: 4 }}>
          <div
            className="dim-fill"
            style={{ width: `${report.progress}%`, background: "var(--brand)" }}
          />
        </div>
      )}

      {/* 子报告 */}
      {report.children.length > 0 && (
        <div className="log-list" style={{ gap: 4 }}>
          {report.children.map((child) => {
            const childCfg = getStatusConfig(child.status);
            return (
              <div
                key={child.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  background: "var(--soft)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line-light)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--ink-light)" }}>{child.template.name}</span>
                <span
                  style={{
                    ...childCfg.color,
                    fontSize: 11,
                  }}
                >
                  {childCfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 底部 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
        <span>
          <i className="ti ti-clock" style={{ marginRight: 4 }} />
          {formatDate(report.createdAt)}
        </span>
        <i className="ti ti-chevron-right" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件：命主分组
// ---------------------------------------------------------------------------

interface IdentityGroupProps {
  group: GroupedReports;
}

function IdentityGroup({ group }: IdentityGroupProps) {
  const { identity, reports } = group;
  const initial = identity.name.charAt(0);

  return (
    <div>
      <div className="group-title">
        <span className="group-count">{reports.length} 份报告</span>
        <span style={{ marginLeft: 8 }}>{identity.name}</span>
      </div>
      <div className="log-list" style={{ marginTop: 10 }}>
        {reports.map((report) => (
          <ReportItem key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { status: sessionStatus } = useSession();
  const requirePhoneBinding = useRequirePhoneBinding();
  const router = useRouter();
  const { showPaywall } = usePaywall();

  const [basicTemplates, setBasicTemplates] = useState<ReportTemplate[]>([]);
  const [advancedTemplates, setAdvancedTemplates] = useState<ReportTemplate[]>([]);
  const [groupedReports, setGroupedReports] = useState<GroupedReports[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);

  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("");
  const [selectedChartRecordId, setSelectedChartRecordId] = useState<string>("");
  const urlPreserveRef = useRef(false);
  const [chartRecords, setChartRecords] = useState<{ id: string; name: string; isPrimary: boolean }[]>([]);
  const [loadingChartRecords, setLoadingChartRecords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [extraInfo, setExtraInfo] = useState("");

  const [activeTab, setActiveTab] = useState<"generate" | "my">("generate");
  const [genStep, setGenStep] = useState(1);

  // -------------------------------------------------------------------------
  // 数据加载
  // -------------------------------------------------------------------------

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/report-templates");
      if (res.ok) {
        const data = await res.json();
        setBasicTemplates(data.basicTemplates ?? []);
        setAdvancedTemplates(data.advancedTemplates ?? []);
      }
    } catch {
      toast.error("加载模板失败");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        const grouped = Object.values(data.grouped ?? {}) as GroupedReports[];
        setGroupedReports(grouped);
      }
    } catch {
      toast.error("加载报告失败");
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const fetchChartRecords = useCallback(async (identityId: string, preserveSelection?: string) => {
    if (!identityId) { setChartRecords([]); return; }
    setLoadingChartRecords(true);
    try {
      const res = await fetch(`/api/charts?identityId=${identityId}`);
      if (res.ok) {
        const data = await res.json();
        const list: { id: string; name: string; isPrimary: boolean }[] = (data.charts ?? []).map(
          (c: { id: string; name: string; isPrimary: boolean }) => ({
            id: c.id, name: c.name, isPrimary: c.isPrimary,
          }),
        );
        setChartRecords(list);
        if (preserveSelection && list.some((c) => c.id === preserveSelection)) {
          setSelectedChartRecordId(preserveSelection);
        } else {
          const primary = list.find((c) => c.isPrimary);
          setSelectedChartRecordId(primary?.id ?? list[0]?.id ?? "");
        }
      } else {
        setChartRecords([]);
        setSelectedChartRecordId("");
      }
    } catch {
      setChartRecords([]);
    } finally {
      setLoadingChartRecords(false);
    }
  }, []);

  const handleIdentityChange = (id: string) => {
    setSelectedIdentityId(id);
    fetchChartRecords(id);
    // O-06：记忆选择
    try {
      localStorage.setItem("lastReportIdentityId", id);
    } catch {
      // 隐私模式下可能失败，忽略
    }
  };

  const fetchIdentities = useCallback(async () => {
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        const list: Identity[] = data.identities ?? [];
        setIdentities(list);
        // O-06：优先用 localStorage 记忆的上次命主，其次 active，再其次第一个
        let picked: Identity | undefined;
        if (!urlPreserveRef.current) {
          const lastIdentityId =
            typeof window !== "undefined"
              ? localStorage.getItem("lastReportIdentityId")
              : null;
          if (lastIdentityId) {
            picked = list.find((i) => i.id === lastIdentityId);
          }
        }
        if (!picked) {
          picked = list.find((i) => i.isActive) ?? list[0];
        }
        if (picked) {
          setSelectedIdentityId(picked.id);
          fetchChartRecords(picked.id);
        }
      }
    } catch {
      toast.error("加载命主列表失败");
    }
  }, [fetchChartRecords]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (sessionStatus === "authenticated") {
      fetchTemplates();
      fetchReports();
      fetchIdentities();
    }
  }, [sessionStatus, router, fetchTemplates, fetchReports, fetchIdentities]);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    const urlIdentityId = searchParams.get("identityId");
    const urlChartRecordId = searchParams.get("chartRecordId");
    if (urlIdentityId) {
      urlPreserveRef.current = true;
      setSelectedIdentityId(urlIdentityId);
      fetchChartRecords(urlIdentityId, urlChartRecordId || undefined);
      setDialogOpen(true);
    }
  }, [searchParams, sessionStatus, fetchChartRecords]);

  useEffect(() => {
    if (activeTab === "my" && sessionStatus === "authenticated") {
      fetchReports();
    }
  }, [activeTab, sessionStatus, fetchReports]);

  useEffect(() => {
    if (activeTab !== "my" || sessionStatus !== "authenticated") return;
    const hasGenerating = groupedReports.some((g) =>
      g.reports.some((r) => r.status === "GENERATING" || r.status === "PENDING")
    );
    if (!hasGenerating) return;
    const timer = setInterval(() => fetchReports(), 10000);
    return () => clearInterval(timer);
  }, [activeTab, sessionStatus, groupedReports, fetchReports]);

  // -------------------------------------------------------------------------
  // 生成报告
  // -------------------------------------------------------------------------

  const handleSelectTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setExtraInfo("");
    setGenStep(1);
    setDialogOpen(true);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !selectedIdentityId) {
      toast.error("请选择命主");
      return;
    }
    if (!selectedChartRecordId) {
      toast.error("请先保存命盘后再生成报告");
      return;
    }
    // B-17：微信登录用户付费前强制绑定手机
    if (requirePhoneBinding()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          identityId: selectedIdentityId,
          chartRecordId: selectedChartRecordId,
          extraInfo: extraInfo.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const reportId = data.report?.id;
        if (reportId) {
          // O-19：保存生成参数，方便报告详情页一键重试
          try {
            localStorage.setItem(
              `zw-report-params-${reportId}`,
              JSON.stringify({
                templateId: selectedTemplate.id,
                identityId: selectedIdentityId,
                chartRecordId: selectedChartRecordId,
                extraInfo: extraInfo.trim() || undefined,
              }),
            );
          } catch {
            // ignore
          }
        }
        toast.success("报告已开始生成");
        setDialogOpen(false);
        setActiveTab("my");
        fetchReports();
      } else if (res.status === 402) {
        // S-08：触发统一付费前置弹层
        const data = await res.json();
        showPaywall({
          reason: data.code,
          message: data.error,
          resource: "REPORT",
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "生成失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // 加载态
  // -------------------------------------------------------------------------

  if (sessionStatus === "loading" || (loadingTemplates && loadingReports)) {
    return (
      <PageContainer maxWidth={1100}>
        <div style={{ height: 128, background: "var(--soft)", borderRadius: "var(--radius)", marginBottom: 16 }} />
        <div className="log-list">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ height: 96, background: "var(--soft)", borderRadius: "var(--radius-sm)" }}
            />
          ))}
        </div>
      </PageContainer>
    );
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  return (
    <PageContainer maxWidth={1100}>
      {/* Hero */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          textAlign: "center",
          padding: "32px 24px",
          background: "linear-gradient(135deg, var(--soft), var(--panel))",
          borderColor: "var(--brand)",
        }}
      >
        <p style={{ fontSize: 11, letterSpacing: "0.3em", color: "var(--text-muted)", marginBottom: 8 }}>
          INSIGHT &amp; DESTINY
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--brand)", margin: "0 0 8px" }}>
          命理报告
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-light)", lineHeight: 1.8, maxWidth: 480, margin: "0 auto" }}>
          基于紫微斗数与心理学的深度分析报告，为你揭示命运轨迹与性格密码
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="seg" style={{ width: "100%", marginBottom: 20 }}>
        <button
          className={`seg-btn ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
          style={{ flex: 1 }}
        >
          <i className="ti ti-sparkles" style={{ marginRight: 4 }} />
          生成报告
        </button>
        <button
          className={`seg-btn ${activeTab === "my" ? "active" : ""}`}
          onClick={() => setActiveTab("my")}
          style={{ flex: 1 }}
        >
          <i className="ti ti-file-text" style={{ marginRight: 4 }} />
          我的报告
        </button>
      </div>

      {/* ======== 生成报告 Tab ======== */}
      {activeTab === "generate" && (
        loadingTemplates ? (
          <div className="template-grid">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "3/4",
                  background: "var(--soft)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
            ))}
          </div>
        ) : (
          <div>
            {/* 前置提示：无命主或无盘时强引导（B-03 修复） */}
            {identities.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: 24,
                  textAlign: "center",
                  borderColor: "var(--brand)",
                  background: "linear-gradient(135deg, var(--soft), var(--panel))",
                }}
              >
                <i
                  className="ti ti-user-plus"
                  style={{ fontSize: 36, color: "var(--brand)", marginBottom: 12 }}
                />
                <h3
                  className="home-section-title"
                  style={{ fontSize: 16, color: "var(--brand)", marginBottom: 6 }}
                >
                  生成报告前需先创建命主
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
                  命主是报告归属的档案（自己/家人/朋友），创建后即可排盘生成报告
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/user")}
                >
                  <i className="ti ti-plus" /> 去创建命主
                </button>
              </div>
            ) : chartRecords.length === 0 ? (
              <div
                className="card"
                style={{
                  padding: 24,
                  textAlign: "center",
                  borderColor: "var(--brand)",
                  background: "linear-gradient(135deg, var(--soft), var(--panel))",
                }}
              >
                <i
                  className="ti ti-clipboard-list"
                  style={{ fontSize: 36, color: "var(--brand)", marginBottom: 12 }}
                />
                <h3
                  className="home-section-title"
                  style={{ fontSize: 16, color: "var(--brand)", marginBottom: 6 }}
                >
                  当前命主还没有已保存的命盘
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
                  排盘后点击「保存」即可基于该盘生成报告
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => router.push("/chart")}
                >
                  <i className="ti ti-stars" /> 去排盘保存
                </button>
              </div>
            ) : null}

            {/* 体验区 */}
            {basicTemplates.length > 0 && (
              <div style={{ marginBottom: 32, marginTop: identities.length === 0 || chartRecords.length === 0 ? 24 : 0 }}>
                <SectionTitle
                  icon="ti-star"
                  title="体验区"
                  extra={<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>基础模板，免费体验</span>}
                />
                <div className="template-grid" style={{ marginTop: 14 }}>
                  {basicTemplates.map((t) => (
                    <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
                  ))}
                </div>
              </div>
            )}

            {/* 会员区 */}
            {advancedTemplates.length > 0 && (
              <div>
                <SectionTitle
                  icon="ti-crown"
                  title="会员区"
                  extra={<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>深度分析，解锁完整洞察</span>}
                />
                <div className="template-grid" style={{ marginTop: 14 }}>
                  {advancedTemplates.map((t) => (
                    <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
                  ))}
                </div>
              </div>
            )}

            {/* 无模板 */}
            {basicTemplates.length === 0 && advancedTemplates.length === 0 && (
              <EmptyState icon="ti-file-text" title="暂无可用的报告模板" />
            )}
          </div>
        )
      )}

      {/* ======== 我的报告 Tab ======== */}
      {activeTab === "my" && (
        loadingReports ? (
          <div className="log-list">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 96, background: "var(--soft)", borderRadius: "var(--radius-sm)" }} />
            ))}
          </div>
        ) : groupedReports.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="ti-user-circle"
              title="暂无报告"
              description="选择一个模板，生成你的第一份命理报告"
            >
              <button className="btn btn-primary" onClick={() => setActiveTab("generate")}>
                去生成报告
              </button>
            </EmptyState>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {groupedReports.map((group) => (
              <IdentityGroup key={group.identity.id} group={group} />
            ))}
          </div>
        )
      )}

      {/* ======== 生成确认对话框（两步流程） ======== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="paywall-dialog">
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i className={`ti ${selectedTemplate?.type === "BASIC" ? "ti-star" : "ti-crown"}`} />
              生成报告
            </DialogTitle>
            <DialogDescription>
              {genStep === 1
                ? `选择命主后开始生成「${selectedTemplate?.name}」报告`
                : `补充背景信息，帮助 AI 更精准地分析`}
            </DialogDescription>
          </DialogHeader>

          {/* 步骤指示器 */}
          <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
            <div style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: genStep >= 1 ? "var(--brand)" : "var(--line)",
            }} />
            <div style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: genStep >= 2 ? "var(--brand)" : "var(--line)",
            }} />
          </div>

          {genStep === 1 ? (
            <>
              {/* 模板信息 */}
              {selectedTemplate && (
                <div
                  style={{
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--line)",
                    background: "var(--soft)",
                    padding: 12,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
                    {selectedTemplate.name}
                  </p>
                  {selectedTemplate.description && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                      {selectedTemplate.description}
                    </p>
                  )}
                  {selectedTemplate.children.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {selectedTemplate.children.map((child) => (
                        <span key={child.id} className="chip" style={{ fontSize: 11, padding: "1px 8px" }}>
                          {child.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {selectedTemplate.pointCost > 0 ? (
                      <span style={{ color: "var(--brand)", fontWeight: 600 }}>
                        {selectedTemplate.pointCost} 星币
                      </span>
                    ) : (
                      <span style={{ color: "var(--success)", fontWeight: 600 }}>免费</span>
                    )}
                  </div>
                </div>
              )}

              {/* 选择命主 */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  选择命主
                </label>
                {identities.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed var(--line)",
                      padding: 12,
                      borderRadius: "var(--radius-sm)",
                      textAlign: "center",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    暂无命主，请先
                    <a href="/user" style={{ color: "var(--brand)", marginLeft: 4, textDecoration: "underline" }}>
                      创建命主
                    </a>
                  </div>
                ) : (
                  <Select value={selectedIdentityId} onValueChange={handleIdentityChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择命主" />
                    </SelectTrigger>
                    <SelectContent>
                      {identities.map((idt) => (
                        <SelectItem key={idt.id} value={idt.id}>
                          {idt.name}
                          {idt.isActive && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--success)" }}>当前</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* 选择命盘 */}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  选择命盘
                </label>
                {!selectedIdentityId ? (
                  <div
                    style={{
                      border: "1px dashed var(--line)",
                      padding: 10,
                      borderRadius: "var(--radius-sm)",
                      textAlign: "center",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    请先选择命主
                  </div>
                ) : loadingChartRecords ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 10 }}>
                    加载命盘列表...
                  </div>
                ) : chartRecords.length === 0 ? (
                  <div
                    style={{
                      border: "1px dashed var(--line)",
                      padding: 10,
                      borderRadius: "var(--radius-sm)",
                      textAlign: "center",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    该命主尚未保存命盘，请先
                    <a href="/chart" style={{ color: "var(--brand)", marginLeft: 4, textDecoration: "underline" }}>
                      去排盘并保存
                    </a>
                  </div>
                ) : (
                  <Select value={selectedChartRecordId} onValueChange={setSelectedChartRecordId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择命盘" />
                    </SelectTrigger>
                    <SelectContent>
                      {chartRecords.map((cr) => (
                        <SelectItem key={cr.id} value={cr.id}>
                          {cr.name}
                          {cr.isPrimary && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--success)" }}>默认</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setGenStep(2)}
                  disabled={!selectedIdentityId || identities.length === 0 || !selectedChartRecordId}
                >
                  下一步 <i className="ti ti-chevron-right" />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 步骤 2：背景信息 */}
              <div
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  background: "var(--soft)",
                  padding: 10,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--text-muted)" }}>报告：</span>
                <strong style={{ color: "var(--ink)" }}>{selectedTemplate?.name}</strong>
                <span style={{ marginLeft: "auto", color: "var(--brand)" }}>
                  {selectedTemplate?.pointCost ?? 0} 星币
                </span>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 6 }}>
                  背景信息（选填）
                </label>
                <textarea
                  className="input"
                  value={extraInfo}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) setExtraInfo(e.target.value);
                  }}
                  placeholder={"填写你想重点了解的内容，例如：\n· 事业方面想了解创业机会\n· 感情方面想知道正缘何时出现\n· 健康方面需要特别注意什么"}
                  style={{ minHeight: 120, resize: "vertical", fontSize: 13, lineHeight: 1.6 }}
                  maxLength={500}
                />
                <div style={{ textAlign: "right", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                  {extraInfo.length}/500
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setGenStep(1)}
                  disabled={submitting}
                >
                  上一步
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGenerate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><i className="ti ti-loader-2 ti-spin" /> 生成中...</>
                  ) : (
                    <>确认生成</>
                  )}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
