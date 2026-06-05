"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Crown,
  UserIcon,
  Plus,
  Edit2,
  Calendar,
  MapPin,
  Network,
  Gift,
  LayoutGrid,
  Share2,
  Settings,
  ShieldCheck,
  Heart,
  LogOut,
  Coins,
  Sparkles,
  ChevronRight,
  Loader2,
  X,
  Clock,
  CreditCard,
  TicketCheck,
  Copy,
  Check,
  FileText,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Users,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface Identity {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  birthday: string;
  birthCity: string | null;
  region: string | null;
  relation: string;
  bazi: string | null;
  isActive: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 用户中心页
// ---------------------------------------------------------------------------

export default function UserPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editIdentity, setEditIdentity] = useState<Identity | null>(null);
  const [saving, setSaving] = useState(false);

  // 余额与兑换
  const [totalPoints, setTotalPoints] = useState(0);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 命主详情弹窗
  const [detailIdentity, setDetailIdentity] = useState<Identity | null>(null);

  // 充值弹窗
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(50);
  const [recharging, setRecharging] = useState(false);

  // 星币流水
  const [pointLogs, setPointLogs] = useState<Array<{
    id: string; type: string; amount: number; source: string;
    sourceLabel: string; detail: string | null; createdAt: string;
  }>>([]);
  const [pointStats, setPointStats] = useState<{
    balance: number; totalIncome: number; totalExpense: number;
    bySource: Record<string, number>;
  } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formGender, setFormGender] = useState<"MALE" | "FEMALE">("MALE");
  const [formBirthday, setFormBirthday] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formRegion, setFormRegion] = useState("");
  const [formRelation, setFormRelation] = useState("SELF");

  // 加载命主列表
  const fetchIdentities = useCallback(async () => {
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        setIdentities(data.identities || []);
      }
    } catch {
      toast.error("加载命主列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载用户资料（余额、邀请码）
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setTotalPoints(data.totalPoints ?? 0);
        setInviteCode(data.inviteCode ?? null);
      }
    } catch {
      // 静默失败
    }
  }, []);

  // 加载星币流水和统计
  const fetchPointData = useCallback(async () => {
    setLogsLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch("/api/user/points/logs?per_page=20"),
        fetch("/api/user/points/stats"),
      ]);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setPointLogs(data.data || []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        setPointStats(data.data || null);
      }
    } catch {
      // 静默失败
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "authenticated") {
      fetchIdentities();
      fetchProfile();
      fetchPointData();
    }
  }, [status, router, fetchIdentities, fetchProfile, fetchPointData]);

  // 重置表单
  const resetForm = () => {
    setFormName("");
    setFormGender("MALE");
    setFormBirthday("");
    setFormCity("");
    setFormRegion("");
    setFormRelation("SELF");
  };

  // 打开添加弹窗
  const openAdd = () => {
    resetForm();
    setEditIdentity(null);
    setShowAddModal(true);
  };

  // 打开编辑弹窗
  const openEdit = (id: Identity) => {
    setFormName(id.name);
    setFormGender(id.gender);
    setFormBirthday(id.birthday);
    setFormCity(id.birthCity || "");
    setFormRegion(id.region || "");
    setFormRelation(id.relation);
    setEditIdentity(id);
    setShowAddModal(true);
  };

  // 保存命主
  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("请输入姓名");
      return;
    }
    if (!formBirthday) {
      toast.error("请选择出生时间");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        gender: formGender,
        birthday: formBirthday,
        birthCity: formCity || undefined,
        region: formRegion || undefined,
        relation: formRelation,
      };

      let res: Response;
      if (editIdentity) {
        res = await fetch(`/api/identities/${editIdentity.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/identities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "操作失败");
      }

      toast.success(editIdentity ? "命主已更新" : "命主已添加");
      setShowAddModal(false);
      fetchIdentities();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSaving(false);
    }
  };

  // 设为活跃命主
  const activateIdentity = async (id: string) => {
    try {
      const res = await fetch(`/api/identities/${id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error("操作失败");
      toast.success("已切换活跃命主");
      fetchIdentities();
    } catch {
      toast.error("切换失败");
    }
  };

  // 退出登录
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // 兑换积分
  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      toast.error("请输入兑换码");
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "兑换成功！");
        setRedeemCode("");
        setShowRedeemModal(false);
        fetchProfile();
      } else {
        toast.error(data.error || "兑换失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setRedeeming(false);
    }
  };

  // 复制邀请码
  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      toast.success("邀请码已复制");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 充值星币
  const handleRecharge = async () => {
    setRecharging(true);
    try {
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: rechargeAmount * 10, channel: "mock" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`充值成功！获得 ${data.points} 星币`);
        setShowRechargeModal(false);
        fetchProfile();
      } else {
        toast.error(data.error || "充值失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setRecharging(false);
    }
  };

  // 未登录 loading
  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
      </div>
    );
  }

  const isPremium = session?.user?.membershipPlan && session.user.membershipPlan !== "FREE";
  const userName = session?.user?.name || "未登录";
  const userId = session?.user?.id || "--";

  // 设置菜单项
  const menuItems = [
    { title: "服务权益", subtitle: "查看会员专属权益", icon: Gift, action: () => router.push("/pricing") },
    { title: "兑换中心", subtitle: "使用兑换码获取积分", icon: Gift, action: () => setShowRedeemModal(true) },
    { title: "关于我们", icon: LayoutGrid, action: () => router.push("/") },
    { title: "偏好设置", icon: Settings, action: () => {} },
    { title: "隐私协议", icon: ShieldCheck, action: () => {} },
  ];

  return (
    <div className="pb-32 space-y-12 min-h-screen bg-background">
      {/* ================================================================
          用户资料区（浅色主题）
      ================================================================= */}
      <div className="relative bg-gradient-to-b from-primary/5 to-background overflow-hidden">
        {/* 装饰光晕 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/3 rounded-full blur-[80px]" />

        <div className="relative z-10 max-w-4xl mx-auto w-full pb-10 space-y-6 p-6 md:p-8">
          {/* 头像 + 用户名 */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 p-1 relative shrink-0">
              <div className="w-full h-full rounded-full bg-primary/5 flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-primary" />
              </div>
              {isPremium && (
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-primary rounded-full border-2 border-background flex items-center justify-center shadow-lg">
                  <Crown className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-bold tracking-tight text-foreground font-serif-sc">{userName}</span>
                {isPremium ? (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                    专属会员
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/5 text-muted-foreground border border-primary/10">
                    普通用户
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground font-mono">ID: {userId.slice(0, 8)}</span>
                <span className="w-1 h-1 rounded-full bg-primary/20" />
                <span className="text-[10px] text-muted-foreground">
                  已绑定 {identities.length} 位命主
                </span>
              </div>
            </div>
          </div>

          {/* 会员升级横幅 */}
          {!isPremium && (
            <button
              onClick={() => router.push("/pricing")}
              className="w-full p-4 rounded-xl bg-primary/5 border border-primary/20 text-foreground flex items-center justify-between shadow-sm group overflow-hidden relative hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold tracking-wide text-foreground">升级专属会员</div>
                  <div className="text-[10px] text-muted-foreground font-medium">解锁高级命理分析报告</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-primary relative z-10 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 w-full">
        {/* ================================================================
            命主档案区
        ================================================================= */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span className="font-serif-sc text-sm font-bold text-foreground">命主档案</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openAdd}
                className="text-[10px] bg-primary text-primary-foreground px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3 h-3 text-primary-foreground" />
                添加新命主
              </button>
            </div>
          </div>

          {/* 命主卡片列表 */}
          <div className="space-y-6">
            {identities.length === 0 ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center bg-card rounded-xl border border-primary/10 shadow-sm cursor-pointer hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all" onClick={openAdd}>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3 text-primary/40">
                  <UserIcon className="w-6 h-6 text-primary/40" />
                </div>
                <span className="text-sm font-bold text-muted-foreground mb-1">尚未添加命主</span>
                <span className="text-[10px] text-muted-foreground">请添加命主以开始命理分析</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {identities.map((id) => (
                    <div
                      key={id.id}
                      className={`p-4 rounded-xl bg-card border shadow-sm hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group relative overflow-hidden ${
                        id.isActive ? "border-primary/30 ring-1 ring-primary/10" : "border-primary/10 hover:border-primary/30"
                      }`}
                      onClick={() => setDetailIdentity(id)}
                    >
                      <div className="relative z-10 flex flex-col gap-3">
                        {/* 头部：性别 + 姓名 + 关系 */}
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            id.gender === "MALE" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                          }`}>
                            <UserIcon className={`w-3 h-3 ${id.gender === "MALE" ? "text-blue-600" : "text-rose-600"}`} />
                          </div>
                          <span className="text-sm font-bold text-foreground truncate">{id.name}</span>
                          {id.relation && id.relation !== "SELF" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-primary/5 text-muted-foreground shrink-0">
                              {id.relation === "SPOUSE" ? "配偶" : id.relation === "CHILD" ? "子女" : id.relation === "PARENT" ? "父母" : id.relation === "SIBLING" ? "兄弟姐妹" : id.relation === "FRIEND" ? "朋友" : id.relation}
                            </span>
                          )}
                          {id.isActive && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary shrink-0">
                              当前
                            </span>
                          )}
                        </div>

                        {/* 八字信息 */}
                        <div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                              id.gender === "MALE" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"
                            }`}>
                              {id.gender === "MALE" ? "乾" : "坤"}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-medium truncate">
                              {id.bazi || "命盘待排"}
                            </span>
                          </div>
                        </div>

                        {/* 生日 + 地区 */}
                        <div className="space-y-1 relative">
                          <div className="text-[9px] text-muted-foreground flex items-center gap-1.5 truncate">
                            <Calendar className="w-2.5 h-2.5 text-muted-foreground/60" />
                            {id.birthday}
                          </div>
                          {id.region && (
                            <div className="text-[9px] text-muted-foreground flex items-center gap-1.5 truncate pr-5">
                              <MapPin className="w-2.5 h-2.5 text-muted-foreground/60" />
                              {id.region}
                            </div>
                          )}
                          {/* 编辑按钮 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(id); }}
                            className="absolute right-0 bottom-0 text-[9px] font-bold text-muted-foreground/40 hover:text-primary transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 背景装饰 */}
                      <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-2xl opacity-10 ${
                        id.gender === "MALE" ? "bg-blue-500" : "bg-rose-500"
                      }`} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 关系网络图入口 */}
            <div className="p-4 rounded-xl bg-card border border-primary/10 flex items-center justify-between cursor-pointer group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Network className="w-4 h-4 text-primary group-hover:text-primary-foreground" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">关系网络图</div>
                  <div className="text-[10px] text-muted-foreground">可视化查看命主间关系</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
          </div>
        </div>

        {/* ================================================================
            资产与会籍区 — 三张快捷卡片
        ================================================================= */}
        <div className="mt-12">
          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="w-1 h-4 bg-primary rounded-full" />
            <span className="font-serif-sc text-sm font-bold text-foreground">资产与会籍</span>
            <span className="text-[10px] text-muted-foreground font-medium ml-auto">ASSETS & MEMBERSHIP</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* 星币余额 */}
            <div
              className="relative p-4 rounded-xl bg-primary/5 border border-primary/20 text-foreground overflow-hidden cursor-pointer group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
              onClick={() => router.push("/pricing")}
            >
              <div className="relative z-10">
                <Coins className="w-6 h-6 text-primary mb-2" />
                <div className="text-2xl font-bold tracking-tight text-foreground">{totalPoints}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">星币余额</div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
            </div>

            {/* 我的报告 */}
            <div
              className="p-4 rounded-xl bg-card border border-primary/10 cursor-pointer group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
              onClick={() => router.push("/reports")}
            >
              <FileText className="w-6 h-6 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
              <div className="text-2xl font-bold tracking-tight text-foreground">报告</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">查看全部</div>
            </div>

            {/* 立即充值 */}
            <div
              className="p-4 rounded-xl bg-primary text-primary-foreground cursor-pointer group hover:bg-primary/90 transition-all"
              onClick={() => setShowRechargeModal(true)}
            >
              <Plus className="w-6 h-6 text-primary-foreground mb-2" />
              <div className="text-sm font-bold">立即充值</div>
              <div className="text-[10px] text-primary-foreground/70 mt-0.5">获取更多星币</div>
            </div>
          </div>
        </div>

        {/* ================================================================
            星币流水
        ================================================================= */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span className="font-serif-sc text-sm font-bold text-foreground">星币流水</span>
            </div>
            <span className="text-[10px] text-muted-foreground">COIN HISTORY</span>
          </div>

          {/* 统计概览 */}
          {pointStats && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUpRight className="w-3 h-3 text-green-600" />
                  <span className="text-[9px] text-green-600 font-medium">总获得</span>
                </div>
                <div className="text-base font-bold text-green-700">{pointStats.totalIncome}</div>
              </div>
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowDownRight className="w-3 h-3 text-orange-600" />
                  <span className="text-[9px] text-orange-600 font-medium">总消费</span>
                </div>
                <div className="text-base font-bold text-orange-700">{pointStats.totalExpense}</div>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1 mb-1">
                  <Coins className="w-3 h-3 text-primary" />
                  <span className="text-[9px] text-primary font-medium">当前余额</span>
                </div>
                <div className="text-base font-bold text-foreground">{pointStats.balance}</div>
              </div>
            </div>
          )}

          {/* 流水列表 */}
          <div className="rounded-xl border border-primary/10 overflow-hidden bg-card">
            {logsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-primary/40 animate-spin" />
              </div>
            ) : pointLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Coins className="w-8 h-8 mb-2 text-primary/20" />
                <span className="text-xs">暂无星币流水记录</span>
              </div>
            ) : (
              <div className="divide-y divide-primary/5">
                {pointLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        log.type === "income"
                          ? "bg-green-50 text-green-600"
                          : "bg-orange-50 text-orange-600"
                      }`}>
                        {log.type === "income"
                          ? <ArrowUpRight className="w-4 h-4" />
                          : <ArrowDownRight className="w-4 h-4" />
                        }
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground">{log.sourceLabel}</div>
                        {log.detail && (
                          <div className="text-[10px] text-muted-foreground">{log.detail}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        log.type === "income" ? "text-green-600" : "text-orange-600"
                      }`}>
                        {log.type === "income" ? "+" : ""}{log.amount}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================
            邀请好友
        ================================================================= */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span className="font-serif-sc text-sm font-bold text-foreground">邀请好友</span>
            </div>
            <span className="text-[10px] text-muted-foreground">INVITE & EARN</span>
          </div>

          <div className="rounded-xl border border-primary/10 bg-card overflow-hidden">
            {/* 邀请码展示 */}
            {inviteCode && (
              <div className="p-5 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-primary/10">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-sm font-bold text-foreground">我的邀请码</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-background border border-primary/15 text-center">
                    <span className="text-xl font-mono font-bold tracking-[0.2em] text-primary">{inviteCode}</span>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-primary/20 text-primary hover:bg-primary/5"
                    onClick={copyInviteCode}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
                <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>好友注册可获得 <strong className="text-primary">10</strong> 星币</span>
                  <span className="w-1 h-1 rounded-full bg-primary/20" />
                  <span>您可获得 <strong className="text-primary">20</strong> 星币</span>
                </div>
              </div>
            )}

            {/* 奖励规则 */}
            <div className="p-5 space-y-3">
              <div className="text-xs font-bold text-foreground">奖励规则</div>
              <div className="space-y-2">
                {[
                  { label: "分享邀请码", value: "好友注册时填写您的邀请码", icon: Share2 },
                  { label: "双方奖励", value: "好友 +10 星币，您 +20 星币", icon: Gift },
                  { label: "无上限", value: "邀请越多好友，获得越多奖励", icon: Sparkles },
                ].map((rule) => (
                  <div key={rule.label} className="flex items-center gap-3 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                      <rule.icon className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-foreground font-medium">{rule.label}</span>
                    <span className="text-muted-foreground">{rule.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================
            系统设置区
        ================================================================= */}
        <div className="mt-12 mb-20">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary/40 rounded-full" />
              <span className="font-serif-sc text-sm font-bold text-foreground">系统设置</span>
            </div>
            <button
              className="p-2 rounded-xl bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
              title="分享应用"
            >
              <Share2 className="w-4 h-4 text-primary hover:text-primary-foreground" />
            </button>
          </div>

          <div className="space-y-2">
            {menuItems.map((item) => (
              <div
                key={item.title}
                onClick={() => item.action()}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-primary/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold block text-foreground">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-[10px] text-muted-foreground block mt-1">{item.subtitle}</div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            ))}

            {/* 退出登录 */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-primary/10 hover:bg-rose-50 hover:border-rose-200 transition-all group mt-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-muted-foreground group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold group-hover:text-rose-600 transition-colors text-foreground">退出登录</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================
          添加/编辑命主弹窗
      ================================================================= */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              {editIdentity ? "编辑命主" : "添加新命主"}
            </DialogTitle>
            <DialogDescription>
              {editIdentity ? "修改命主的基本信息" : "输入命主的出生信息，用于命理分析"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 姓名 */}
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="请输入姓名"
              />
            </div>

            {/* 性别 */}
            <div className="space-y-2">
              <Label>性别 *</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFormGender("MALE")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    formGender === "MALE"
                      ? "bg-blue-50 text-blue-600 border-2 border-blue-200"
                      : "bg-primary/5 text-muted-foreground border-2 border-transparent hover:border-primary/20"
                  }`}
                >
                  乾（男）
                </button>
                <button
                  onClick={() => setFormGender("FEMALE")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    formGender === "FEMALE"
                      ? "bg-rose-50 text-rose-600 border-2 border-rose-200"
                      : "bg-primary/5 text-muted-foreground border-2 border-transparent hover:border-primary/20"
                  }`}
                >
                  坤（女）
                </button>
              </div>
            </div>

            {/* 出生时间 */}
            <div className="space-y-2">
              <Label htmlFor="birthday">出生时间 *</Label>
              <Input
                id="birthday"
                type="datetime-local"
                value={formBirthday}
                onChange={(e) => setFormBirthday(e.target.value)}
              />
            </div>

            {/* 出生城市 */}
            <div className="space-y-2">
              <Label htmlFor="city">出生城市</Label>
              <Input
                id="city"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="例如：南京"
              />
            </div>

            {/* 地区 */}
            <div className="space-y-2">
              <Label htmlFor="region">省份/地区</Label>
              <Input
                id="region"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                placeholder="例如：江苏省"
              />
            </div>

            {/* 关系 */}
            <div className="space-y-2">
              <Label>与您的关系</Label>
              <Select value={formRelation} onValueChange={setFormRelation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SELF">自己</SelectItem>
                  <SelectItem value="SPOUSE">配偶</SelectItem>
                  <SelectItem value="CHILD">子女</SelectItem>
                  <SelectItem value="PARENT">父母</SelectItem>
                  <SelectItem value="SIBLING">兄弟姐妹</SelectItem>
                  <SelectItem value="FRIEND">朋友</SelectItem>
                  <SelectItem value="OTHER">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              取消
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editIdentity ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 兑换中心弹窗 */}
      <Dialog open={showRedeemModal} onOpenChange={setShowRedeemModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <TicketCheck className="w-4 h-4 text-primary" />
              </div>
              兑换中心
            </DialogTitle>
            <DialogDescription>
              输入兑换码获取积分，兑换码不区分大小写
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redeem-code">兑换码</Label>
              <Input
                id="redeem-code"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="请输入兑换码"
                className="text-center text-lg tracking-widest font-mono"
                maxLength={32}
              />
            </div>

            {inviteCode && (
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">我的邀请码</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-foreground flex-1">{inviteCode}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={copyInviteCode}
                  >
                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground">分享邀请码给好友，双方均可获得积分奖励</div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedeemModal(false)}>
              取消
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleRedeem}
              disabled={redeeming || !redeemCode.trim()}
            >
              {redeeming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  兑换中...
                </>
              ) : (
                "立即兑换"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 命主详情弹窗 */}
      <Dialog open={!!detailIdentity} onOpenChange={(open) => { if (!open) setDetailIdentity(null); }}>
        <DialogContent className="max-w-sm">
          {detailIdentity && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${detailIdentity.gender === "MALE" ? "bg-blue-500" : "bg-rose-500"}`}>
                    {detailIdentity.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-base font-bold">{detailIdentity.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${detailIdentity.gender === "MALE" ? "bg-blue-50 text-blue-600" : "bg-rose-50 text-rose-600"}`}>
                        {detailIdentity.gender === "MALE" ? "乾" : "坤"}
                      </span>
                      {detailIdentity.relation && (
                        <span className="text-[10px] text-muted-foreground">
                          {detailIdentity.relation === "SELF" ? "自己" : detailIdentity.relation}
                        </span>
                      )}
                      {detailIdentity.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary">当前</span>
                      )}
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  {detailIdentity.birthday}{detailIdentity.region ? ` · ${detailIdentity.region}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2 py-2">
                <button
                  onClick={() => { setDetailIdentity(null); router.push("/reports"); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors group"
                >
                  <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium text-foreground">查看报告</span>
                </button>
                <button
                  onClick={() => { setDetailIdentity(null); router.push("/chart"); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/5 hover:bg-blue-50 transition-colors group"
                >
                  <Network className="w-5 h-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-medium text-foreground">八字排盘</span>
                </button>
                <button
                  onClick={() => { setDetailIdentity(null); router.push("/reports"); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/5 hover:bg-green-50 transition-colors group"
                >
                  <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-green-500 transition-colors" />
                  <span className="text-xs font-medium text-foreground">AI 对话</span>
                </button>
                <button
                  onClick={() => { const id = detailIdentity; setDetailIdentity(null); openEdit(id); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors group"
                >
                  <Edit2 className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs font-medium text-foreground">编辑信息</span>
                </button>
              </div>

              {!detailIdentity.isActive && (
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => { activateIdentity(detailIdentity.id); setDetailIdentity(null); }}
                >
                  设为当前命主
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 充值弹窗 */}
      <Dialog open={showRechargeModal} onOpenChange={setShowRechargeModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Coins className="w-4 h-4 text-primary" />
              </div>
              充值星币
            </DialogTitle>
            <DialogDescription>
              1元 = 10星币，大额充值赠送更多
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { amount: 20, coins: 200, bonus: 0, tag: "" },
                { amount: 50, coins: 500, bonus: 50, tag: "热门" },
                { amount: 100, coins: 1000, bonus: 150, tag: "" },
                { amount: 300, coins: 3000, bonus: 600, tag: "超值" },
              ].map((opt) => (
                <button
                  key={opt.amount}
                  onClick={() => setRechargeAmount(opt.amount)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    rechargeAmount === opt.amount
                      ? "border-primary bg-primary/5"
                      : "border-primary/10 bg-card hover:border-primary/30"
                  }`}
                >
                  {opt.tag && (
                    <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      {opt.tag}
                    </span>
                  )}
                  <div className="text-lg font-bold text-foreground">¥{opt.amount}</div>
                  <div className="text-xs text-muted-foreground">
                    {opt.coins}星币
                    {opt.bonus > 0 && (
                      <span className="text-primary ml-1">+{opt.bonus}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 p-3 rounded-lg bg-primary/5 text-center">
              <span className="text-xs text-muted-foreground">可获得 </span>
              <span className="text-base font-bold text-primary">
                {rechargeAmount * 10 + (rechargeAmount === 50 ? 50 : rechargeAmount === 100 ? 150 : rechargeAmount === 300 ? 600 : 0)}
              </span>
              <span className="text-xs text-muted-foreground"> 星币</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRechargeModal(false)}>
              取消
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={handleRecharge}
              disabled={recharging}
            >
              {recharging ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  充值中...
                </>
              ) : (
                `确认充值 ¥${rechargeAmount}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
