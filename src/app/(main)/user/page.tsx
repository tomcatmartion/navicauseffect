"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
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

const RELATION_LABEL: Record<string, string> = {
  SELF: "自己",
  SPOUSE: "配偶",
  CHILD: "子女",
  PARENT: "父母",
  SIBLING: "兄弟姐妹",
  FRIEND: "朋友",
  OTHER: "其他",
};

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

  const [totalPoints, setTotalPoints] = useState(0);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [detailIdentity, setDetailIdentity] = useState<Identity | null>(null);

  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(50);
  const [recharging, setRecharging] = useState(false);

  const [pointLogs, setPointLogs] = useState<Array<{
    id: string; type: string; amount: number; source: string;
    sourceLabel: string; detail: string | null; createdAt: string;
  }>>([]);
  const [pointStats, setPointStats] = useState<{
    balance: number; totalIncome: number; totalExpense: number;
    bySource: Record<string, number>;
  } | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const [formName, setFormName] = useState("");
  const [formGender, setFormGender] = useState<"MALE" | "FEMALE">("MALE");
  const [formBirthday, setFormBirthday] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formRegion, setFormRegion] = useState("");
  const [formRelation, setFormRelation] = useState("SELF");

  // -------------------------------------------------------------------------
  // 数据加载
  // -------------------------------------------------------------------------

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

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setTotalPoints(data.totalPoints ?? 0);
        setInviteCode(data.inviteCode ?? null);
      }
    } catch {
      // 静默
    }
  }, []);

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
      // 静默
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

  // -------------------------------------------------------------------------
  // 命主管理
  // -------------------------------------------------------------------------

  const resetForm = () => {
    setFormName("");
    setFormGender("MALE");
    setFormBirthday("");
    setFormCity("");
    setFormRegion("");
    setFormRelation("SELF");
  };

  const openAdd = () => {
    resetForm();
    setEditIdentity(null);
    setShowAddModal(true);
  };

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

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

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

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      toast.success("邀请码已复制");
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <PageContainer maxWidth={1100}>
        <EmptyState icon="ti-loader-2" title="加载中…" />
      </PageContainer>
    );
  }

  const isPremium = session?.user?.membershipPlan && session.user.membershipPlan !== "FREE";
  const userName = session?.user?.name || "未登录";
  const userId = session?.user?.id || "--";

  // C-02：关于/用户协议/隐私政策已合并到 /settings，user 页只保留核心操作入口
  const menuItems = [
    { title: "服务权益", subtitle: "查看会员专属权益", icon: "ti-gift", action: () => router.push("/pricing") },
    { title: "兑换中心", subtitle: "使用兑换码获取星币", icon: "ti-ticket", action: () => setShowRedeemModal(true) },
    { title: "偏好设置", subtitle: undefined, icon: "ti-settings", action: () => router.push("/settings") },
  ];

  const rechargeOptions = [
    { amount: 20, coins: 200, bonus: 0, tag: "" },
    { amount: 50, coins: 500, bonus: 50, tag: "热门" },
    { amount: 100, coins: 1000, bonus: 150, tag: "" },
    { amount: 300, coins: 3000, bonus: 600, tag: "超值" },
  ];

  const totalRechargeCoins =
    rechargeAmount * 10 +
    (rechargeAmount === 50 ? 50 : rechargeAmount === 100 ? 150 : rechargeAmount === 300 ? 600 : 0);

  return (
    <PageContainer maxWidth={1100}>
      {/* ================================================================
          用户资料卡
      ================================================================= */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--soft)",
            border: "2px solid var(--line)",
            color: "var(--brand)",
            fontSize: 28,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <i className="ti ti-user" />
          {isPremium && (
            <i
              className="ti ti-crown"
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--brand)",
                color: "#fff",
                border: "2px solid var(--panel)",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              {userName}
            </h1>
            <span
              className="chip"
              style={
                isPremium
                  ? { background: "var(--brand)", color: "#fff", border: "none", padding: "1px 8px", fontSize: 10 }
                  : { padding: "1px 8px", fontSize: 10 }
              }
            >
              {isPremium ? "专属会员" : "普通用户"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{ fontFamily: "var(--font-mono, monospace)" }}>ID: {userId.slice(0, 8)}</span>
            <span>·</span>
            <span>已绑定 {identities.length} 位命主</span>
          </div>
        </div>
      </div>

      {/* 升级横幅 */}
      {!isPremium && (
        <button
          onClick={() => router.push("/pricing")}
          className="card"
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            cursor: "pointer",
            background: "linear-gradient(135deg, var(--soft), var(--panel))",
            borderColor: "var(--brand)",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-sm)",
                background: "var(--soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand)",
                fontSize: 20,
              }}
            >
              <i className="ti ti-crown" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>升级专属会员</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>解锁高级命理分析报告</div>
            </div>
          </div>
          <i className="ti ti-chevron-right" style={{ color: "var(--brand)" }} />
        </button>
      )}

      {/* ================================================================
          命主档案
      ================================================================= */}
      <div style={{ marginTop: 28 }}>
        <SectionTitle
          icon="ti-users"
          title="命主档案"
          extra={
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <i className="ti ti-plus" /> 添加新命主
            </button>
          }
        />
      </div>

      {identities.length === 0 ? (
        <div className="card" style={{ marginTop: 12, cursor: "pointer" }} onClick={openAdd}>
          <EmptyState icon="ti-user-plus" title="尚未添加命主" description="请添加命主以开始命理分析" />
        </div>
      ) : (
        <div
          className="template-grid"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginTop: 14 }}
        >
          {identities.map((id) => {
            const isMale = id.gender === "MALE";
            const genderBg = isMale ? "var(--success-soft, rgba(44,74,30,.08))" : "var(--danger-soft, rgba(139,26,26,.08))";
            const genderColor = isMale ? "var(--success)" : "var(--danger)";
            return (
              <div
                key={id.id}
                className={`card${id.isActive ? " selected" : ""}`}
                style={{ cursor: "pointer", padding: 14 }}
                onClick={() => setDetailIdentity(id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: genderBg,
                      color: genderColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    <i className="ti ti-user" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {id.name}
                  </span>
                  {id.relation && id.relation !== "SELF" && (
                    <span className="chip" style={{ fontSize: 10, padding: "1px 6px" }}>
                      {RELATION_LABEL[id.relation] || id.relation}
                    </span>
                  )}
                  {id.isActive && (
                    <span
                      className="chip"
                      style={{ background: "var(--brand)", color: "#fff", border: "none", fontSize: 10, padding: "1px 6px" }}
                    >
                      当前
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: genderBg,
                      color: genderColor,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {isMale ? "乾" : "坤"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {id.bazi || "命盘待排"}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="ti ti-calendar" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{id.birthday}</span>
                </div>
                {id.region && (
                  <div style={{ marginTop: 2, fontSize: 10, color: "var(--text-muted)" }}>
                    <i className="ti ti-map-pin" style={{ marginRight: 4 }} />
                    {id.region}
                  </div>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(id); }}
                  className="iconbtn"
                  style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, fontSize: 11 }}
                  title="编辑"
                >
                  <i className="ti ti-edit" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 关系网络图入口（即将推出） */}
      <div
        className="setting-row"
        style={{
          marginTop: 12,
          width: "100%",
          textDecoration: "none",
          color: "inherit",
          opacity: 0.6,
          cursor: "not-allowed",
        }}
        title="功能开发中，敬请期待"
        aria-disabled="true"
      >
        <div className="sr-l">
          <div className="sr-icon"><i className="ti ti-topology-star-ring-3" /></div>
          <div>
            <div className="sr-title">
              关系网络图
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  padding: "2px 6px",
                  background: "var(--soft)",
                  color: "var(--text-muted)",
                  borderRadius: 4,
                  fontWeight: 400,
                }}
              >
                即将推出
              </span>
            </div>
            <div className="sr-desc">可视化查看命主间关系</div>
          </div>
        </div>
        <i className="ti ti-hourglass-high" style={{ color: "var(--text-muted)" }} />
      </div>

      {/* ================================================================
          资产与会籍
      ================================================================= */}
      <div style={{ marginTop: 28 }}>
        <SectionTitle icon="ti-wallet" title="资产与会籍" />
      </div>
      <div
        className="template-grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}
      >
        <button
          className="coin-card"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => router.push("/pricing")}
        >
          <i className="ti ti-coin" style={{ color: "var(--warning)", fontSize: 22 }} />
          <div className="coin-amount">{totalPoints}</div>
          <div className="coin-price">星币余额</div>
        </button>

        <button
          className="coin-card"
          style={{ cursor: "pointer", textAlign: "left" }}
          onClick={() => router.push("/reports")}
        >
          <i className="ti ti-file-text" style={{ color: "var(--brand)", fontSize: 22 }} />
          <div className="coin-amount" style={{ fontSize: 18 }}>报告</div>
          <div className="coin-price">查看全部</div>
        </button>

        {/* B-07 + C-04：mock 充值入口仅 dev 环境显示，生产环境改为跳 /pricing 正规充值 */}
        {process.env.NODE_ENV === "development" ? (
          <button
            className="coin-card"
            style={{
              cursor: "pointer",
              textAlign: "left",
              background: "var(--brand)",
              color: "#fff",
              borderColor: "var(--brand)",
            }}
            onClick={() => setShowRechargeModal(true)}
          >
            <i className="ti ti-plus" style={{ fontSize: 22 }} />
            <div className="coin-amount" style={{ color: "#fff", fontSize: 16 }}>立即充值</div>
            <div className="coin-price" style={{ color: "rgba(255,255,255,.7)" }}>获取更多星币（测试）</div>
          </button>
        ) : (
          <button
            className="coin-card"
            style={{
              cursor: "pointer",
              textAlign: "left",
              background: "var(--brand)",
              color: "#fff",
              borderColor: "var(--brand)",
            }}
            onClick={() => router.push("/pricing")}
          >
            <i className="ti ti-plus" style={{ fontSize: 22 }} />
            <div className="coin-amount" style={{ color: "#fff", fontSize: 16 }}>立即充值</div>
            <div className="coin-price" style={{ color: "rgba(255,255,255,.7)" }}>前往会员中心</div>
          </button>
        )}
      </div>

      {/* ================================================================
          星币流水
      ================================================================= */}
      <div style={{ marginTop: 28 }}>
        <SectionTitle icon="ti-history" title="星币流水" />
      </div>

      {/* 统计概览 */}
      {pointStats && (
        <div className="share-stats" style={{ marginTop: 14 }}>
          <div className="ss" style={{ background: "var(--success-soft, rgba(44,74,30,.08))", borderColor: "var(--success)" }}>
            <div className="ss-v" style={{ color: "var(--success)", fontSize: 20 }}>{pointStats.totalIncome}</div>
            <div className="ss-l">总获得</div>
          </div>
          <div className="ss" style={{ background: "var(--warning-soft, rgba(196,154,74,.1))", borderColor: "var(--warning)" }}>
            <div className="ss-v" style={{ color: "var(--warning)", fontSize: 20 }}>{pointStats.totalExpense}</div>
            <div className="ss-l">总消费</div>
          </div>
          <div className="ss">
            <div className="ss-v" style={{ fontSize: 20 }}>{pointStats.balance}</div>
            <div className="ss-l">当前余额</div>
          </div>
        </div>
      )}

      {/* 流水列表 */}
      <div className="card" style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
        {logsLoading ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 20, color: "var(--brand)" }} />
          </div>
        ) : pointLogs.length === 0 ? (
          <EmptyState icon="ti-coin" title="暂无星币流水记录" />
        ) : (
          <div className="log-list" style={{ gap: 0 }}>
            {pointLogs.map((log) => (
              <div
                key={log.id}
                className={`log-item ${log.type === "income" ? "income" : "expense"}`}
                style={{ borderRadius: 0, border: "none", borderBottom: "1px solid var(--line-light)", margin: 0 }}
              >
                <div className={`log-icon`}>
                  <i className={`ti ${log.type === "income" ? "ti-trending-up" : "ti-trending-down"}`} />
                </div>
                <div className="log-info">
                  <div className="log-title">{log.sourceLabel}</div>
                  {log.detail && <div className="log-meta">{log.detail}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className={`log-amount`}>
                    {log.type === "income" ? "+" : ""}{log.amount}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(log.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================
          邀请好友
      ================================================================= */}
      <div style={{ marginTop: 28 }}>
        <SectionTitle icon="ti-gift" title="邀请好友" />
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        {inviteCode && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <i className="ti ti-users" style={{ color: "var(--brand)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>我的邀请码</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--soft)",
                  border: "1px dashed var(--brand)",
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: 700,
                    letterSpacing: 3,
                    color: "var(--brand)",
                  }}
                >
                  {inviteCode}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={copyInviteCode}>
                <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} />
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 16 }}>
              <span>好友注册可获得 <strong style={{ color: "var(--brand)" }}>10</strong> 星币</span>
              <span>·</span>
              <span>您可获得 <strong style={{ color: "var(--brand)" }}>20</strong> 星币</span>
            </div>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            奖励规则
          </div>
          <div className="log-list">
            {[
              { label: "分享邀请码", value: "好友注册时填写您的邀请码", icon: "ti-share" },
              { label: "双方奖励", value: "好友 +10 星币，您 +20 星币", icon: "ti-gift" },
              { label: "无上限", value: "邀请越多好友，获得越多奖励", icon: "ti-sparkles" },
            ].map((rule) => (
              <div key={rule.label} className="log-item" style={{ padding: 8 }}>
                <div className="sr-icon" style={{ width: 28, height: 28 }}>
                  <i className={`ti ${rule.icon}`} />
                </div>
                <div className="log-info">
                  <div className="log-title" style={{ fontSize: 13 }}>{rule.label}</div>
                  <div className="log-meta">{rule.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================
          系统设置
      ================================================================= */}
      <div style={{ marginTop: 28, marginBottom: 32 }}>
        <SectionTitle
          icon="ti-settings"
          title="系统设置"
          extra={
            <button className="iconbtn" title="分享应用">
              <i className="ti ti-share" />
            </button>
          }
        />
      </div>
      <div className="log-list" style={{ marginTop: 12 }}>
        {menuItems.map((item) => (
          <button
            key={item.title}
            onClick={item.action}
            className="setting-row"
            style={{ width: "100%", cursor: "pointer", textDecoration: "none", color: "inherit" }}
          >
            <div className="sr-l">
              <div className="sr-icon"><i className={`ti ${item.icon}`} /></div>
              <div>
                <div className="sr-title">{item.title}</div>
                {item.subtitle && <div className="sr-desc">{item.subtitle}</div>}
              </div>
            </div>
            <i className="ti ti-chevron-right" />
          </button>
        ))}

        <button
          onClick={handleLogout}
          className="setting-row"
          style={{
            width: "100%",
            cursor: "pointer",
            textDecoration: "none",
            color: "var(--danger)",
            borderColor: "var(--danger)",
          }}
        >
          <div className="sr-l">
            <div className="sr-icon" style={{ background: "var(--danger-soft, rgba(139,26,26,.08))", color: "var(--danger)" }}>
              <i className="ti ti-logout" />
            </div>
            <div>
              <div className="sr-title" style={{ color: "var(--danger)" }}>退出登录</div>
            </div>
          </div>
        </button>
      </div>

      {/* ================================================================
          添加/编辑命主弹窗
      ================================================================= */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="paywall-dialog">
          <DialogHeader>
            <DialogTitle>
              <i className="ti ti-user-plus" style={{ marginRight: 6 }} />
              {editIdentity ? "编辑命主" : "添加新命主"}
            </DialogTitle>
            <DialogDescription>
              {editIdentity ? "修改命主的基本信息" : "输入命主的出生信息，用于命理分析"}
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
            <div>
              <label style={labelStyle}>姓名 *</label>
              <input
                className="input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="请输入姓名"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={labelStyle}>性别 *</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["MALE", "FEMALE"] as const).map((g) => {
                  const active = formGender === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setFormGender(g)}
                      className="btn"
                      style={{
                        flex: 1,
                        background: active ? "var(--brand)" : "var(--soft)",
                        color: active ? "#fff" : "var(--text-muted)",
                        border: "1px solid " + (active ? "var(--brand)" : "var(--line)"),
                        fontWeight: 600,
                      }}
                    >
                      {g === "MALE" ? "乾（男）" : "坤（女）"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>出生时间 *</label>
              <input
                className="input"
                type="datetime-local"
                value={formBirthday}
                onChange={(e) => setFormBirthday(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={labelStyle}>出生城市</label>
              <input
                className="input"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="例如：南京"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={labelStyle}>省份/地区</label>
              <input
                className="input"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                placeholder="例如：江苏省"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={labelStyle}>与您的关系</label>
              <Select value={formRelation} onValueChange={setFormRelation}>
                <SelectTrigger className="w-full">
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

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>
              取消
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <i className="ti ti-loader-2 ti-spin" style={{ marginRight: 4 }} />}
              {editIdentity ? "保存" : "添加"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 兑换中心 */}
      <Dialog open={showRedeemModal} onOpenChange={setShowRedeemModal}>
        <DialogContent className="paywall-dialog">
          <DialogHeader>
            <DialogTitle>
              <i className="ti ti-ticket" style={{ marginRight: 6 }} />
              兑换中心
            </DialogTitle>
            <DialogDescription>
              输入兑换码获取星币，兑换码不区分大小写
            </DialogDescription>
          </DialogHeader>

          <div style={{ paddingTop: 12 }}>
            <label style={labelStyle}>兑换码</label>
            <input
              className="input"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="请输入兑换码"
              style={{
                width: "100%",
                textAlign: "center",
                fontSize: 18,
                letterSpacing: 4,
                fontFamily: "var(--font-mono, monospace)",
              }}
              maxLength={32}
            />

            {inviteCode && (
              <div
                style={{
                  marginTop: 12,
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--soft)",
                  padding: 10,
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                  我的邀请码
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "var(--ink)" }}>
                    {inviteCode}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={copyInviteCode}>
                    <i className={`ti ${copied ? "ti-check" : "ti-copy"}`} />
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRedeemModal(false)}>
              取消
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRedeem}
              disabled={redeeming || !redeemCode.trim()}
            >
              {redeeming ? (
                <><i className="ti ti-loader-2 ti-spin" /> 兑换中...</>
              ) : (
                "立即兑换"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 命主详情 */}
      <Dialog open={!!detailIdentity} onOpenChange={(open) => { if (!open) setDetailIdentity(null); }}>
        <DialogContent className="paywall-dialog">
          {detailIdentity && (
            <>
              <DialogHeader>
                <DialogTitle style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: detailIdentity.gender === "MALE" ? "var(--success)" : "var(--danger)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                    }}
                  >
                    {detailIdentity.name.charAt(0)}
                  </div>
                  <div>
                    <div>{detailIdentity.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 11 }}>
                      <span
                        className="chip"
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: detailIdentity.gender === "MALE" ? "var(--success-soft)" : "var(--danger-soft)",
                          color: detailIdentity.gender === "MALE" ? "var(--success)" : "var(--danger)",
                          border: "none",
                        }}
                      >
                        {detailIdentity.gender === "MALE" ? "乾" : "坤"}
                      </span>
                      {detailIdentity.relation && (
                        <span style={{ color: "var(--text-muted)" }}>
                          {RELATION_LABEL[detailIdentity.relation] || detailIdentity.relation}
                        </span>
                      )}
                      {detailIdentity.isActive && (
                        <span className="chip" style={{ background: "var(--brand)", color: "#fff", border: "none", fontSize: 10, padding: "1px 6px" }}>
                          当前
                        </span>
                      )}
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  {detailIdentity.birthday}{detailIdentity.region ? ` · ${detailIdentity.region}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div
                className="template-grid"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 12 }}
              >
                <button
                  onClick={() => { setDetailIdentity(null); router.push("/reports"); }}
                  className="coin-card"
                  style={{ cursor: "pointer" }}
                >
                  <i className="ti ti-file-text" style={{ color: "var(--brand)" }} />
                  <div className="coin-amount" style={{ fontSize: 13 }}>查看报告</div>
                </button>
                <button
                  onClick={() => { setDetailIdentity(null); router.push("/chart"); }}
                  className="coin-card"
                  style={{ cursor: "pointer" }}
                >
                  <i className="ti ti-layout-grid" style={{ color: "var(--brand)" }} />
                  <div className="coin-amount" style={{ fontSize: 13 }}>八字排盘</div>
                </button>
                <button
                  onClick={() => { setDetailIdentity(null); router.push("/reports"); }}
                  className="coin-card"
                  style={{ cursor: "pointer" }}
                >
                  <i className="ti ti-message-2" style={{ color: "var(--brand)" }} />
                  <div className="coin-amount" style={{ fontSize: 13 }}>AI 对话</div>
                </button>
                <button
                  onClick={() => { const id = detailIdentity; setDetailIdentity(null); openEdit(id); }}
                  className="coin-card"
                  style={{ cursor: "pointer" }}
                >
                  <i className="ti ti-edit" style={{ color: "var(--brand)" }} />
                  <div className="coin-amount" style={{ fontSize: 13 }}>编辑信息</div>
                </button>
              </div>

              {!detailIdentity.isActive && (
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 12 }}
                  onClick={() => { activateIdentity(detailIdentity.id); setDetailIdentity(null); }}
                >
                  设为当前命主
                </button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 充值（B-07 + C-04：mock 仅 dev 环境）*/}
      {process.env.NODE_ENV === "development" && (
      <Dialog open={showRechargeModal} onOpenChange={setShowRechargeModal}>
        <DialogContent className="paywall-dialog">
          <DialogHeader>
            <DialogTitle>
              <i className="ti ti-coin" style={{ marginRight: 6 }} />
              充值星币
            </DialogTitle>
            <DialogDescription>
              1元 = 10星币，大额充值赠送更多
            </DialogDescription>
          </DialogHeader>

          <div style={{ paddingTop: 12 }}>
            <div
              className="template-grid"
              style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              {rechargeOptions.map((opt) => {
                const active = rechargeAmount === opt.amount;
                return (
                  <button
                    key={opt.amount}
                    onClick={() => setRechargeAmount(opt.amount)}
                    className={`coin-card${active ? " selected" : ""}`}
                    style={{
                      cursor: "pointer",
                      position: "relative",
                      textAlign: "left",
                      padding: 14,
                    }}
                  >
                    {opt.tag && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "var(--brand)",
                          color: "#fff",
                        }}
                      >
                        {opt.tag}
                      </span>
                    )}
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                      ¥{opt.amount}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                      {opt.coins}星币
                      {opt.bonus > 0 && (
                        <span style={{ color: "var(--brand)", marginLeft: 4 }}>+{opt.bonus}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 14,
                padding: 10,
                borderRadius: "var(--radius-sm)",
                background: "var(--soft)",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>可获得 </span>
              <strong style={{ color: "var(--brand)", fontSize: 16 }}>{totalRechargeCoins}</strong>
              <span style={{ color: "var(--text-muted)" }}> 星币</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRechargeModal(false)}>
              取消
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRecharge}
              disabled={recharging}
            >
              {recharging ? (
                <><i className="ti ti-loader-2 ti-spin" /> 充值中...</>
              ) : (
                "确认充值"
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </PageContainer>
  );
}

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink)",
  marginBottom: 6,
};
