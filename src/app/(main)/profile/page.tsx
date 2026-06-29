"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface UserProfile {
  id: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  wechatBound?: boolean;
  wechatOpenIdMasked?: string | null;
  role: string;
  totalPoints: number;
  bonusQueries: number;
  inviteCode: string;
  createdAt: string;
  dailyUsed?: number;
  dailyLimit?: number;
  membership: {
    plan: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  stats: {
    consultations: number;
    orders: number;
    shares: number;
    /** C-11：可选扩展字段（API 已返回，旧前端未消费） */
    charts?: number;
    identities?: number;
    reports?: number;
  };
}

const PLAN_LABELS: Record<string, string> = {
  FREE: "普通用户",
  MONTHLY: "月度会员",
  QUARTERLY: "季度会员",
  YEARLY: "年度会员",
};

const statCardStyle: CSSProperties = {
  background: "var(--panel)",
  border: "1px solid var(--line-light)",
  borderRadius: "var(--radius-sm)",
  padding: "16px 12px",
  textAlign: "center",
  boxShadow: "var(--shadow)",
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");

  // 换绑手机号状态
  const [showBindForm, setShowBindForm] = useState(false);
  const [bindPhone, setBindPhone] = useState("");
  const [bindCode, setBindCode] = useState("");
  const [bindCountdown, setBindCountdown] = useState(0);
  const [bindLoading, setBindLoading] = useState(false);
  // C-11：统计「查看更多」抽屉
  const [showStatsDialog, setShowStatsDialog] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNewNickname(data.nickname || "");
      }
    } catch {
      toast.error("加载个人信息失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, router]);

  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) {
      toast.error("昵称不能为空");
      return;
    }
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: newNickname.trim() }),
      });
      if (res.ok) {
        toast.success("昵称已更新");
        setEditing(false);
        fetchProfile();
      } else {
        const data = await res.json();
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleCopyInviteCode = () => {
    if (profile?.inviteCode) {
      navigator.clipboard.writeText(profile.inviteCode);
      toast.success("邀请码已复制");
    }
  };

  const handleCopyUserId = () => {
    if (profile?.id) {
      navigator.clipboard.writeText(profile.id);
      toast.success("用户 ID 已复制");
    }
  };

  // 换绑倒计时
  useEffect(() => {
    if (bindCountdown <= 0) return;
    const t = setTimeout(() => setBindCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [bindCountdown]);

  const handleSendBindCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(bindPhone)) {
      toast.error("手机号格式不合法");
      return;
    }
    if (bindCountdown > 0) return;
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: bindPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "发送失败");
        return;
      }
      setBindCountdown(60);
      if (data.mock) {
        toast.success("开发环境验证码为 123456", { duration: 5000 });
      } else {
        toast.success("验证码已发送");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleBindPhone = async () => {
    if (!bindPhone || !bindCode) {
      toast.error("请填写手机号和验证码");
      return;
    }
    setBindLoading(true);
    try {
      const res = await fetch("/api/user/bind-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: bindPhone.trim(), code: bindCode.trim() }),
      });
      const data = await res.json();
      setBindLoading(false);
      if (!res.ok) {
        toast.error(data.error || "换绑失败");
        return;
      }
      toast.success("手机号已更新");
      setShowBindForm(false);
      setBindPhone("");
      setBindCode("");
      fetchProfile();
    } catch {
      toast.error("网络错误");
      setBindLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <PageContainer maxWidth={900}>
        <div className="log-list">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 128,
                background: "var(--soft)",
                borderRadius: "var(--radius-sm)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (!profile) return null;

  const isPremium =
    profile.membership?.plan === "MONTHLY" ||
    profile.membership?.plan === "QUARTERLY" ||
    profile.membership?.plan === "YEARLY";

  const membershipExpired =
    profile.membership?.endDate &&
    new Date(profile.membership.endDate) < new Date();

  return (
    <PageContainer maxWidth={900}>
      <SectionTitle as="h1" icon="ti-user-circle" title="个人中心" />

      {/* O-01/O-02：三中心快速导航 chip（解决 profile/user/settings 入口分散） */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 14,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/user"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            fontSize: 12,
            color: "var(--brand)",
            textDecoration: "none",
          }}
        >
          <i className="ti ti-id-badge-2" /> 命主档案
        </Link>
        <Link
          href="/settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            fontSize: 12,
            color: "var(--brand)",
            textDecoration: "none",
          }}
        >
          <i className="ti ti-settings" /> 偏好设置
        </Link>
        <Link
          href="/pricing"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            fontSize: 12,
            color: "var(--brand)",
            textDecoration: "none",
          }}
        >
          <i className="ti ti-crown" /> 会员与充值
        </Link>
        <Link
          href="/promoter"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            fontSize: 12,
            color: "var(--brand)",
            textDecoration: "none",
          }}
        >
          <i className="ti ti-megaphone" /> 推广中心
        </Link>
      </div>

      {/* 用户卡 */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--soft)",
              border: "1px solid var(--line)",
              color: "var(--brand)",
              fontSize: 22,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {profile.nickname?.charAt(0) || "U"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  className="input"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  style={{ height: 32, width: 160, padding: "4px 10px", fontSize: 14 }}
                  maxLength={20}
                />
                <button className="btn btn-primary btn-sm" onClick={handleUpdateNickname}>
                  <i className="ti ti-check" /> 保存
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                  取消
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: 18, color: "var(--ink)", fontWeight: 600, margin: 0 }}>
                  {profile.nickname || "未设置昵称"}
                </h2>
                <button
                  className="iconbtn"
                  onClick={() => setEditing(true)}
                  title="编辑昵称"
                  style={{ width: 28, height: 28, fontSize: 13 }}
                >
                  <i className="ti ti-edit" />
                </button>
              </div>
            )}
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                className="chip"
                style={
                  isPremium && !membershipExpired
                    ? { background: "var(--warning)", color: "#fff", border: "none" }
                    : {}
                }
              >
                <i className="ti ti-crown" />
                {isPremium && !membershipExpired
                  ? PLAN_LABELS[profile.membership!.plan]
                  : membershipExpired
                  ? "会员已过期"
                  : "普通用户"}
              </span>
              {profile.role === "ADMIN" && (
                <span
                  className="chip"
                  style={{ background: "var(--danger)", color: "#fff", border: "none" }}
                >
                  管理员
                </span>
              )}
            </div>
          </div>
        </div>
        {(profile.email || profile.phone) && (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            {profile.email && <><i className="ti ti-mail" style={{ marginRight: 4 }} />{profile.email}</>}
            {profile.email && profile.phone && <span style={{ margin: "0 8px" }}>·</span>}
            {profile.phone && <><i className="ti ti-device-mobile" style={{ marginRight: 4 }} />{profile.phone}</>}
          </p>
        )}
      </div>

      {/* 账号与安全 */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle icon="ti-shield-lock" title="账号与安全" />
      </div>
      <div style={{ marginTop: 12 }}>
        {/* 用户 ID */}
        <div className="setting-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-fingerprint" /></div>
            <div>
              <div className="sr-title">用户 ID</div>
              <div className="sr-desc">{profile.id.slice(0, 12)}…</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleCopyUserId}
            title="复制完整 ID"
          >
            <i className="ti ti-copy" /> 复制
          </button>
        </div>

        {/* 注册时间 */}
        <div className="setting-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-calendar-time" /></div>
            <div>
              <div className="sr-title">注册时间</div>
              <div className="sr-desc">
                {new Date(profile.createdAt).toLocaleString("zh-CN")}
              </div>
            </div>
          </div>
        </div>

        {/* 手机号 */}
        <div className="setting-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-device-mobile" /></div>
            <div>
              <div className="sr-title">手机号</div>
              <div className="sr-desc">
                {profile.phone
                  ? profile.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
                  : "未绑定"}
              </div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setShowBindForm(!showBindForm);
              setBindPhone("");
              setBindCode("");
            }}
          >
            <i className="ti ti-edit" /> {profile.phone ? "换绑" : "立即绑定"}
          </button>
        </div>

        {/* 换绑表单(inline 展开) */}
        {showBindForm && (
          <div
            className="card"
            style={{ marginTop: 8, padding: 16 }}
          >
            <div className="field">
              <label className="field-label">新手机号</label>
              <input
                className="input"
                type="tel"
                value={bindPhone}
                onChange={(e) => setBindPhone(e.target.value)}
                placeholder="11 位手机号"
                maxLength={11}
              />
            </div>
            <div className="field">
              <label className="field-label">验证码</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="input"
                  type="text"
                  value={bindCode}
                  onChange={(e) => setBindCode(e.target.value)}
                  placeholder="6 位验证码"
                  maxLength={6}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={handleSendBindCode}
                  disabled={bindCountdown > 0}
                >
                  {bindCountdown > 0 ? `${bindCountdown}s` : "获取"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBindPhone}
                disabled={bindLoading}
              >
                {bindLoading ? "处理中…" : "确认换绑"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowBindForm(false)}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 登录密码 */}
        <div className="setting-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-lock" /></div>
            <div>
              <div className="sr-title">登录密码</div>
              <div className="sr-desc">建议定期更换密码</div>
            </div>
          </div>
          <Link href="/auth/change-password" className="btn btn-ghost btn-sm">
            <i className="ti ti-edit" /> 修改密码
          </Link>
        </div>

        {/* 微信 */}
        <div className="setting-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-brand-wechat" /></div>
            <div>
              <div className="sr-title">微信账号</div>
              <div className="sr-desc">
                {profile.wechatBound
                  ? `已绑定 (${profile.wechatOpenIdMasked ?? "***"})`
                  : "未绑定"}
              </div>
            </div>
          </div>
          {profile.wechatBound ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (!window.confirm("确定要解绑微信吗？解绑后将无法使用微信登录此账号。")) return;
                try {
                  const res = await fetch("/api/auth/wechat/unbind", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(data.error || "解绑失败", { duration: 4000 });
                    return;
                  }
                  toast.success("微信已解绑");
                  // 刷新 profile
                  fetchProfile();
                } catch {
                  toast.error("网络错误，请稍后重试");
                }
              }}
            >
              <i className="ti ti-unlink" /> 解绑
            </button>
          ) : (
            <Link href="/auth/bind-wechat" className="btn btn-ghost btn-sm">
              <i className="ti ti-link" /> 扫码绑定
            </Link>
          )}
        </div>

        {/* C-14：邀请码已合并到「邀请好友」区，避免与账号安全区重复展示 */}

        {/* 今日用量(免费用户显示,会员显示"无限") */}
        <div className="setting-row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-chart-bar" /></div>
            <div>
              <div className="sr-title">今日用量</div>
              <div
                className="sr-desc"
                style={{
                  color:
                    profile.dailyLimit &&
                    profile.dailyLimit !== Infinity &&
                    profile.dailyUsed !== undefined &&
                    profile.dailyUsed >= profile.dailyLimit * 0.8
                      ? "var(--warning)"
                      : undefined,
                }}
              >
                {profile.dailyUsed ?? 0} /{" "}
                {profile.dailyLimit === Infinity || !profile.dailyLimit
                  ? "∞"
                  : profile.dailyLimit}
                次
                {profile.dailyLimit &&
                  profile.dailyLimit !== Infinity &&
                  profile.dailyUsed !== undefined &&
                  profile.dailyUsed >= profile.dailyLimit * 0.8 &&
                  " · 即将达到上限,升级会员无限使用"}
              </div>
            </div>
          </div>
          {(!profile.dailyLimit || profile.dailyLimit !== Infinity) && (
            <Link href="/pricing" className="btn btn-ghost btn-sm">
              <i className="ti ti-crown" /> 升级
            </Link>
          )}
        </div>
      </div>

      {/* 会员状态（仅 premium 显示） */}
      {isPremium && profile.membership?.endDate && (
        <div
          className="card"
          style={{
            marginTop: 14,
            background: "var(--warning-soft, rgba(196, 154, 74, 0.08))",
            borderColor: "var(--warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              <i className="ti ti-crown" style={{ marginRight: 6, color: "var(--warning)" }} />
              {PLAN_LABELS[profile.membership.plan]} · {membershipExpired ? "已过期" : "有效中"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
              到期时间：{new Date(profile.membership.endDate).toLocaleDateString("zh-CN")}
            </p>
          </div>
          {membershipExpired && (
            <Link href="/pricing" className="btn btn-primary btn-sm">
              <i className="ti ti-refresh" /> 续费
            </Link>
          )}
        </div>
      )}

      {/* 三宫统计 + C-11 查看更多 */}
      <div className="share-stats" style={{ marginTop: 14 }}>
        <div className="ss">
          <div className="ss-v">{profile.totalPoints}</div>
          <div className="ss-l">星币</div>
        </div>
        <div className="ss">
          <div className="ss-v">{profile.bonusQueries}</div>
          <div className="ss-l">奖励次数</div>
        </div>
        <div className="ss">
          <div className="ss-v">{profile.stats.consultations}</div>
          <div className="ss-l">排盘次数</div>
        </div>
        <button
          type="button"
          className="ss"
          onClick={() => setShowStatsDialog(true)}
          style={{
            cursor: "pointer",
            background: "var(--soft)",
            border: "1px dashed var(--line)",
            color: "var(--brand)",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
          title="查看更多统计"
        >
          <i className="ti ti-dots-horizontal" style={{ fontSize: 18 }} />
          <div className="ss-l" style={{ fontSize: 11 }}>更多</div>
        </button>
      </div>

      {/* 邀请好友 */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle icon="ti-gift" title="邀请好友" />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.8, marginTop: 0 }}>
          分享给好友，每次有效分享获得 1 星币，每 10 星币可兑换 1 次免费测算
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <code
            style={{
              flex: 1,
              background: "var(--soft)",
              border: "1px dashed var(--line)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              textAlign: "center",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 14,
              color: "var(--brand)",
              letterSpacing: 1,
            }}
          >
            {profile.inviteCode}
          </code>
          <button className="btn btn-ghost btn-sm" onClick={handleCopyInviteCode}>
            <i className="ti ti-copy" /> 复制
          </button>
        </div>
      </div>

      {/* 升级会员（非 premium） */}
      {!isPremium && (
        <div className="card" style={{ marginTop: 14, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>
            <i className="ti ti-sparkles" style={{ marginRight: 6, color: "var(--brand)" }} />
            升级会员，解锁完整 AI 分析和更多功能
          </p>
          <Link href="/pricing" className="btn btn-primary" style={{ marginTop: 8 }}>
            查看会员方案
          </Link>
        </div>
      )}

      {/* 历史记录区（占位 — 详细流水待迁入） */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle icon="ti-history" title="历史记录" />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        {profile.stats.consultations > 0 ? (
          <p style={{ color: "var(--ink-light)", fontSize: 14 }}>
            共 <strong style={{ color: "var(--brand)" }}>{profile.stats.consultations}</strong> 次排盘记录
          </p>
        ) : (
          <EmptyState icon="ti-history" title="暂无排盘记录" description="点击下方按钮开始第一次排盘" />
        )}
        <Link href="/chart" className="btn btn-primary" style={{ width: "100%", marginTop: 12 }}>
          <i className="ti ti-plus" /> 去排盘
        </Link>
      </div>

      {/* 设置入口 */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle icon="ti-settings" title="设置" />
      </div>
      <div style={{ marginTop: 12 }}>
        <Link
          href="/settings"
          className="setting-row"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-adjustments" /></div>
            <div>
              <div className="sr-title">偏好设置</div>
              <div className="sr-desc">主题、历法、通知</div>
            </div>
          </div>
          <i className="ti ti-chevron-right" />
        </Link>
        <Link
          href="/promoter"
          className="setting-row"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="sr-l">
            <div className="sr-icon"><i className="ti ti-megaphone" /></div>
            <div>
              <div className="sr-title">我的推广</div>
              <div className="sr-desc">邀请好友注册，赚取星币</div>
            </div>
          </div>
          <i className="ti ti-chevron-right" />
        </Link>
      </div>

      {/* 退出登录 */}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => signOut({ callbackUrl: "/" })}
          style={{ color: "var(--danger)" }}
        >
          <i className="ti ti-logout" /> 退出登录
        </button>
      </div>

      {/* C-11：完整统计抽屉 */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="paywall-dialog">
          <DialogHeader>
            <DialogTitle>
              <i className="ti ti-chart-bar" style={{ marginRight: 6 }} />
              完整使用统计
            </DialogTitle>
            <DialogDescription>所有数据由系统自动记录</DialogDescription>
          </DialogHeader>
          <div className="template-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12 }}>
            {[
              { label: "命主档案", value: profile.stats.identities, icon: "ti-user", color: "var(--brand)" },
              { label: "命盘数", value: profile.stats.charts, icon: "ti-clipboard-list", color: "var(--brand)" },
              { label: "报告数", value: profile.stats.reports, icon: "ti-file-text", color: "var(--success)" },
              { label: "订单数", value: profile.stats.orders, icon: "ti-receipt", color: "var(--warning)" },
              { label: "分享次数", value: profile.stats.shares, icon: "ti-share-3", color: "var(--brand)" },
              { label: "排盘次数", value: profile.stats.consultations, icon: "ti-spiral", color: "var(--text-muted)" },
            ].map((item) => (
              <div
                key={item.label}
                className="coin-card"
                style={{ padding: 14, cursor: "default", textAlign: "left" }}
              >
                <i className={`ti ${item.icon}`} style={{ color: item.color, fontSize: 18 }} />
                <div className="coin-amount" style={{ fontSize: 20 }}>{item.value}</div>
                <div className="coin-price">{item.label}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
