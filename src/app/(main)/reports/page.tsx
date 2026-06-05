"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Star,
  Crown,
  Clock,
  FileText,
  Loader2,
  UserCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/** 报告模板 - 子模板 */
interface TemplateChild {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

/** 报告模板 */
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

/** 命主 */
interface Identity {
  id: string;
  name: string;
  gender: string;
  birthday: string;
  relation: string;
  isActive: boolean;
}

/** 子报告 */
interface ChildReport {
  id: string;
  status: string;
  progress: number;
  template: { id: string; name: string; slug: string };
}

/** 报告 */
interface Report {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
  template: { id: string; name: string; slug: string; type: string };
  identity: { id: string; name: string; gender: string };
  children: ChildReport[];
}

/** 按命主分组的报告 */
interface GroupedReports {
  identity: { id: string; name: string; gender: string };
  reports: Report[];
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 状态文案与颜色 */
function getStatusConfig(status: string): {
  label: string;
  className: string;
  pulse: boolean;
} {
  switch (status) {
    case "COMPLETED":
      return { label: "已完成", className: "bg-green-100 text-green-700", pulse: false };
    case "FAILED":
      return { label: "失败", className: "bg-red-100 text-red-700", pulse: false };
    case "GENERATING":
      return { label: "生成中", className: "bg-primary/10 text-primary", pulse: true };
    case "PENDING":
    default:
      return { label: "等待中", className: "bg-muted text-muted-foreground", pulse: false };
  }
}

/** 性别 → 头像背景色 */
function genderColor(gender: string): string {
  return gender === "M" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600";
}

/** 格式化日期 */
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
  const hasChildren = template.children.length > 0;
  const isAdvanced = template.type === "ADVANCED";

  // 区分「高亮标签」（热门/推荐/限时）和「信息标签」（字数/子报告等）
  const highlightTags = template.tags.filter((t) =>
    ["热门", "推荐", "限时", "重磅"].includes(t)
  );
  const infoTags = template.tags.filter(
    (t) => !["热门", "推荐", "限时", "重磅"].includes(t)
  );

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-primary/10 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/8"
      onClick={() => onSelect(template)}
    >
      {/* 封面区 — 沉浸式渐变背景 */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {template.bgImage ? (
          <>
            <img
              src={template.bgImage}
              alt={template.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          /* 无图片时：根据类型生成不同风格渐变 */
          <div className="flex h-full w-full items-center justify-center">
            <div
              className={`absolute inset-0 ${
                isAdvanced
                  ? "bg-gradient-to-br from-primary/15 via-primary/8 to-accent/10"
                  : "bg-gradient-to-br from-primary/8 via-background to-primary/12"
              }`}
            />
            {/* 装饰光圈 */}
            <div className="absolute right-[-20%] top-[-20%] h-[80%] w-[60%] rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-[-10%] left-[-10%] h-[50%] w-[40%] rounded-full bg-accent/5 blur-2xl" />
            {/* 中心图标 */}
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 shadow-md ring-1 ring-primary/10">
              {isAdvanced ? (
                <Crown className="h-7 w-7 text-primary" />
              ) : (
                <Star className="h-7 w-7 text-primary/80" />
              )}
            </div>
          </div>
        )}
        {/* 底部渐变遮罩（仅无图片时） */}
        {!template.bgImage && (
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-card to-transparent" />
        )}
        {/* 左上角类型标记 */}
        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold backdrop-blur-sm ${
              isAdvanced
                ? "bg-primary/80 text-white"
                : "bg-white/70 text-primary"
            }`}
          >
            {isAdvanced ? (
              <Crown className="h-3 w-3" />
            ) : (
              <Star className="h-3 w-3" />
            )}
            {isAdvanced ? "深度" : "体验"}
          </span>
        </div>
      </div>

      {/* 信息区 */}
      <CardContent className="space-y-2.5 px-4 pb-4 pt-3.5">
        {/* 标题 + 高亮标签 */}
        <div className="flex items-start gap-2">
          <h3 className="text-sm font-bold text-foreground leading-snug">
            {template.name}
          </h3>
          {highlightTags.length > 0 && (
            <div className="flex shrink-0 gap-1">
              {highlightTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 子报告分类标签 */}
        {hasChildren && (
          <div className="flex flex-wrap gap-1.5">
            {template.children.map((child) => (
              <span
                key={child.id}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground/70"
              >
                {child.name}
              </span>
            ))}
          </div>
        )}

        {/* 描述 — 价值主张 */}
        {template.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {template.description}
          </p>
        )}

        {/* 底部：信息标签 + 价格/箭头 */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex flex-wrap gap-1.5">
            {infoTags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium text-muted-foreground/70"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {template.pointCost > 0 ? (
              <span className="text-xs font-bold text-primary">
                {template.pointCost}
                <span className="font-normal text-muted-foreground"> 星币</span>
              </span>
            ) : (
              <span className="text-xs font-bold text-green-600">免费</span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
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
    <Card
      className="cursor-pointer border-primary/10 bg-card transition-all hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        {/* 头部：类型图标 + 模板名称 + 状态徽章 */}
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/8">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">
              {report.template.name}
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.className}`}
          >
            {statusCfg.pulse && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
            {statusCfg.label}
          </span>
        </div>

        {/* 进度条 */}
        {(report.status === "GENERATING" || report.status === "PENDING") && (
          <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
              style={{ width: `${report.progress}%` }}
            />
          </div>
        )}

        {/* 子报告状态 */}
        {report.children.length > 0 && (
          <div className="mb-2.5 space-y-1.5">
            {report.children.map((child) => {
              const childCfg = getStatusConfig(child.status);
              return (
                <div key={child.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5">
                  <span className="text-xs font-medium text-foreground/70">{child.template.name}</span>
                  <span
                    className={`rounded-full px-2 py-px text-[10px] font-medium ${childCfg.className}`}
                  >
                    {childCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 底部：命主 + 时间 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(report.createdAt)}</span>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
        </div>
      </CardContent>
    </Card>
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
    <div className="space-y-3">
      {/* 命主信息 */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${genderColor(identity.gender)}`}
        >
          {initial}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{identity.name}</span>
            <Badge variant="outline" className="border-primary/20 text-xs text-primary">
              {reports.length} 份报告
            </Badge>
          </div>
        </div>
      </div>

      {/* 报告列表 */}
      <div className="space-y-2 pl-1">
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
  const router = useRouter();

  // 数据状态
  const [basicTemplates, setBasicTemplates] = useState<ReportTemplate[]>([]);
  const [advancedTemplates, setAdvancedTemplates] = useState<ReportTemplate[]>([]);
  const [groupedReports, setGroupedReports] = useState<GroupedReports[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);

  // 加载状态
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [extraInfo, setExtraInfo] = useState("");

  // 当前 Tab
  const [activeTab, setActiveTab] = useState("generate");
  // 生成弹窗步骤: 1=选命主, 2=填背景
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

  const fetchIdentities = useCallback(async () => {
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        const list: Identity[] = data.identities ?? [];
        setIdentities(list);
        // 默认选中当前活跃的命主
        const active = list.find((i) => i.isActive);
        if (active) {
          setSelectedIdentityId(active.id);
        }
      }
    } catch {
      toast.error("加载命主列表失败");
    }
  }, []);

  // 首次加载
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

  // 切换到"我的报告"时刷新列表
  useEffect(() => {
    if (activeTab === "my" && sessionStatus === "authenticated") {
      fetchReports();
    }
  }, [activeTab, sessionStatus, fetchReports]);

  // 自动轮询：我的报告Tab有生成中的报告时，每10秒刷新
  useEffect(() => {
    if (activeTab !== "my" || sessionStatus !== "authenticated") return;

    const hasGenerating = groupedReports.some((g) =>
      g.reports.some(
        (r) => r.status === "GENERATING" || r.status === "PENDING"
      )
    );
    if (!hasGenerating) return;

    const timer = setInterval(() => {
      fetchReports();
    }, 10000);

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

    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          identityId: selectedIdentityId,
          extraInfo: extraInfo.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success("报告已开始生成");
        setDialogOpen(false);
        // 切换到我的报告
        setActiveTab("my");
        fetchReports();
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
  // 加载骨架屏
  // -------------------------------------------------------------------------

  if (sessionStatus === "loading" || (loadingTemplates && loadingReports)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <div className="mb-8 h-48 animate-pulse rounded-xl bg-primary/5" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-primary/5" />
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center md:py-20">
          <p className="mb-4 text-sm tracking-[0.3em] text-accent-foreground/60">
            Insight &amp; Destiny
          </p>
          <h1 className="mb-3 font-serif-sc text-3xl font-bold text-primary md:text-4xl">
            命理报告
          </h1>
          <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground">
            基于紫微斗数与心理学的深度分析报告，为你揭示命运轨迹与性格密码
          </p>
        </div>
      </section>

      {/* 内容区域 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab 切换 */}
          <TabsList className="mb-6 w-full bg-primary/5">
            <TabsTrigger
              value="generate"
              className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              生成报告
            </TabsTrigger>
            <TabsTrigger
              value="my"
              className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              <FileText className="mr-1.5 h-4 w-4" />
              我的报告
            </TabsTrigger>
          </TabsList>

          {/* ======== 生成报告 Tab ======== */}
          <TabsContent value="generate">
            {loadingTemplates ? (
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="aspect-video animate-pulse rounded-xl bg-primary/5" />
                ))}
              </div>
            ) : (
              <div className="space-y-10">
                {/* 体验区 */}
                {basicTemplates.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Star className="h-4 w-4 text-primary" />
                      </div>
                      <h2 className="font-serif-sc text-lg font-bold text-primary">体验区</h2>
                      <span className="text-xs text-muted-foreground">基础模板，免费体验</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {basicTemplates.map((t) => (
                        <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 会员区 */}
                {advancedTemplates.length > 0 && (
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Crown className="h-4 w-4 text-primary" />
                      </div>
                      <h2 className="font-serif-sc text-lg font-bold text-primary">会员区</h2>
                      <span className="text-xs text-muted-foreground">深度分析，解锁完整洞察</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {advancedTemplates.map((t) => (
                        <TemplateCard key={t.id} template={t} onSelect={handleSelectTemplate} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 无模板 */}
                {basicTemplates.length === 0 && advancedTemplates.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FileText className="mb-3 h-12 w-12 text-primary/30" />
                    <p className="text-sm text-muted-foreground">暂无可用的报告模板</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ======== 我的报告 Tab ======== */}
          <TabsContent value="my">
            {loadingReports ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-primary/5" />
                ))}
              </div>
            ) : groupedReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <UserCircle className="mb-3 h-12 w-12 text-primary/30" />
                <p className="mb-1 text-sm text-muted-foreground">暂无报告</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  选择一个模板，生成你的第一份命理报告
                </p>
                <Button
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => setActiveTab("generate")}
                >
                  去生成报告
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedReports.map((group) => (
                  <IdentityGroup key={group.identity.id} group={group} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* ======== 生成确认对话框（两步流程） ======== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.type === "BASIC" ? (
                <Star className="h-5 w-5 text-primary" />
              ) : (
                <Crown className="h-5 w-5 text-primary" />
              )}
              生成报告
            </DialogTitle>
            <DialogDescription>
              {genStep === 1
                ? `选择命主后开始生成「${selectedTemplate?.name}」报告`
                : `补充背景信息，帮助 AI 更精准地分析`}
            </DialogDescription>
          </DialogHeader>

          {/* 步骤指示器 */}
          <div className="mb-2 flex items-center gap-2">
            <div className={`flex-1 h-1 rounded-full ${genStep >= 1 ? "bg-primary" : "bg-primary/10"}`} />
            <div className={`flex-1 h-1 rounded-full ${genStep >= 2 ? "bg-primary" : "bg-primary/10"}`} />
          </div>

          {genStep === 1 ? (
            <>
              {/* 模板信息 */}
              {selectedTemplate && (
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <p className="mb-1 text-sm font-medium">
                    {selectedTemplate.name}
                  </p>
                  {selectedTemplate.description && (
                    <p className="mb-2 text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                  {selectedTemplate.children.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.children.map((child) => (
                        <span
                          key={child.id}
                          className="rounded-md bg-background px-2 py-0.5 text-xs text-primary shadow-sm"
                        >
                          {child.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    {selectedTemplate.pointCost > 0 ? (
                      <span className="font-medium text-primary">
                        {selectedTemplate.pointCost} 星币
                      </span>
                    ) : (
                      <span className="font-medium text-green-600">免费</span>
                    )}
                  </div>
                </div>
              )}

              {/* 选择命主 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">选择命主</label>
                {identities.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-primary/20 p-4 text-center text-xs text-muted-foreground">
                    暂无命主，请先
                    <a
                      href="/user"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      创建命主
                    </a>
                  </div>
                ) : (
                  <Select value={selectedIdentityId} onValueChange={setSelectedIdentityId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="请选择命主" />
                    </SelectTrigger>
                    <SelectContent>
                      {identities.map((idt) => (
                        <SelectItem key={idt.id} value={idt.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${genderColor(idt.gender)}`}
                            >
                              {idt.name.charAt(0)}
                            </span>
                            {idt.name}
                            {idt.isActive && (
                              <span className="text-[10px] text-green-500">当前</span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  取消
                </Button>
                <Button
                  className="bg-primary text-white hover:bg-primary/90"
                  onClick={() => setGenStep(2)}
                  disabled={!selectedIdentityId || identities.length === 0}
                >
                  下一步
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* 步骤2：背景信息 */}
              <div className="space-y-3">
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">报告：</span>
                    <span className="text-xs font-bold">{selectedTemplate?.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{selectedTemplate?.pointCost} 星币</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">背景信息（选填）</label>
                  <Textarea
                    value={extraInfo}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) setExtraInfo(e.target.value);
                    }}
                    placeholder="填写你想重点了解的内容，例如：&#10;· 事业方面想了解创业机会&#10;· 感情方面想知道正缘何时出现&#10;· 健康方面需要特别注意什么"
                    className="min-h-[120px] resize-none text-sm"
                    maxLength={500}
                  />
                  <div className="text-right text-[10px] text-muted-foreground">
                    {extraInfo.length}/500
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setGenStep(1)} disabled={submitting}>
                  上一步
                </Button>
                <Button
                  className="bg-primary text-white hover:bg-primary/90"
                  onClick={handleGenerate}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    "确认生成"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
