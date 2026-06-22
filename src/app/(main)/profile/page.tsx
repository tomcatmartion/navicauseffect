"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

interface UserProfile {
  id: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  totalPoints: number;
  bonusQueries: number;
  inviteCode: string;
  createdAt: string;
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

      {/* 三宫统计 */}
      <div className="share-stats" style={{ marginTop: 14 }}>
        <div className="ss">
          <div className="ss-v">{profile.totalPoints}</div>
          <div className="ss-l">积分</div>
        </div>
        <div className="ss">
          <div className="ss-v">{profile.bonusQueries}</div>
          <div className="ss-l">奖励次数</div>
        </div>
        <div className="ss">
          <div className="ss-v">{profile.stats.consultations}</div>
          <div className="ss-l">排盘次数</div>
        </div>
      </div>

      {/* 邀请好友 */}
      <div style={{ marginTop: 24 }}>
        <SectionTitle icon="ti-gift" title="邀请好友" />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.8, marginTop: 0 }}>
          分享给好友，每次有效分享获得 1 积分，每 10 积分可兑换 1 次免费测算
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
    </PageContainer>
  );
}
