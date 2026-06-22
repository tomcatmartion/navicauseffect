"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageContainer } from "@/components/shared/page-container";
import { SectionTitle } from "@/components/shared/section-title";
import { EmptyState } from "@/components/shared/empty-state";

// ──────────────────────────────────────────────────────────────
// 类型
// ──────────────────────────────────────────────────────────────

type Stats = {
  shareCount: number;
  totalClicks: number;
  teamCount: number;
  shareReward: number;
  totalEarned: number;
  totalRewardPoints: number;
};

type PromoterStats = {
  inviteCode: string;
  totalPoints: number;
  stats: Stats;
  promoterProfile: {
    id: string;
    level: number;
    isActive: boolean;
    createdAt: string;
  } | null;
};

type Earning = {
  id: string;
  eventType: string;
  points: number;
  fromUserId: string;
  createdAt: string;
};

type TeamMember = {
  id: string;
  displayName: string;
  joinedAt: string;
  contributedPoints: number;
};

// ──────────────────────────────────────────────────────────────
// 渠道配置（沿用 /share 旧版的 CHANNELS）
// ──────────────────────────────────────────────────────────────

type ShareChannel = {
  key: string;
  platform: "WECHAT" | "MOMENTS" | "WEIBO" | "QQ" | "LINK" | "QRCODE" | "REDBOOK" | "ZHIHU";
  label: string;
  desc: string;
  icon: string;
  color?: string;
  action: "copy" | "intent" | "toast";
  intentUrl?: string;
};

const CHANNELS: ShareChannel[] = [
  {
    key: "wechat",
    platform: "WECHAT",
    label: "微信好友",
    desc: "复制链接后粘贴给微信好友",
    icon: "ti-brand-wechat",
    color: "#07c160",
    action: "copy",
  },
  {
    key: "moments",
    platform: "MOMENTS",
    label: "朋友圈",
    desc: "复制链接 + 推荐文案发朋友圈",
    icon: "ti-device-imessage",
    color: "#07c160",
    action: "copy",
  },
  {
    key: "weibo",
    platform: "WEIBO",
    label: "新浪微博",
    desc: "跳转微博分享",
    icon: "ti-brand-weibo",
    color: "#e6162d",
    action: "intent",
    intentUrl: "https://service.weibo.com/share/share.php",
  },
  {
    key: "qq",
    platform: "QQ",
    label: "QQ",
    desc: "跳转 QQ 分享",
    icon: "ti-brand-qq",
    color: "#12b7f5",
    action: "intent",
    intentUrl: "https://connect.qq.com/widget/shareqq/index.html",
  },
  {
    key: "link",
    platform: "LINK",
    label: "复制链接",
    desc: "复制专属邀请链接",
    icon: "ti-link",
    action: "copy",
  },
  {
    key: "qrcode",
    platform: "QRCODE",
    label: "二维码",
    desc: "生成二维码图片",
    icon: "ti-qrcode",
    action: "toast",
  },
  {
    key: "redbook",
    platform: "REDBOOK",
    label: "小红书",
    desc: "复制推荐文案（手动发布）",
    icon: "ti-brand-redhat",
    color: "#ff2741",
    action: "toast",
  },
  {
    key: "zhihu",
    platform: "ZHIHU",
    label: "知乎",
    desc: "跳转知乎",
    icon: "ti-brand-zhihu",
    color: "#0084ff",
    action: "toast",
  },
];

const EVENT_LABELS: Record<string, string> = {
  REGISTER: "好友注册",
  PURCHASE: "好友充值返点",
};

// ──────────────────────────────────────────────────────────────
// 主组件
// ──────────────────────────────────────────────────────────────

export default function PromoterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<PromoterStats | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"share" | "team" | "earnings">("share");
  const [sharing, setSharing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, earningsRes, teamRes] = await Promise.all([
        fetch("/api/promoter"),
        fetch("/api/promoter/earnings?limit=10"),
        fetch("/api/promoter/team?limit=10"),
      ]);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setData(statsData);
        // 拉取最近 10 条收益
        if (earningsRes.ok) {
          const eData = await earningsRes.json();
          setEarnings(eData.earnings ?? []);
        }
        if (teamRes.ok) {
          const tData = await teamRes.json();
          setTeam(tData.members ?? []);
        }
      }
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "authenticated") {
      loadData();
    }
  }, [status, router, loadData]);

  // 邀请码（兜底：session.user.id slice）
  const inviteCode = data?.inviteCode ?? (session?.user?.id ? session.user.id.slice(0, 8).toUpperCase() : "");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  const shareUrl = origin ? `${origin}/?ref=${inviteCode}` : "";
  const shareText = `刚在紫微问道排了命盘，AI 解读超准！快来试试：${shareUrl}`;

  const handleShare = useCallback(
    async (channel: ShareChannel) => {
      if (status !== "authenticated") {
        toast.info("请先登录后分享");
        router.push("/auth/login");
        return;
      }
      setSharing(channel.key);
      try {
        if (channel.action === "copy") {
          await navigator.clipboard.writeText(
            channel.key === "link" ? shareUrl : shareText,
          );
          toast.success(`已复制${channel.key === "link" ? "邀请链接" : "分享文案"}`);
        } else if (channel.action === "intent" && channel.intentUrl) {
          const url = `${channel.intentUrl}?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
          window.open(url, "_blank", "noopener,noreferrer");
          toast.info(`已打开${channel.label}，请确认发布`);
        } else {
          toast.info(`${channel.label}：请手动复制以下链接发布`);
          await navigator.clipboard.writeText(shareText);
        }
        // 记录分享到后端
        try {
          const res = await fetch("/api/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: channel.platform, shareUrl }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.reward > 0) {
              toast.success(`+${result.reward} 星币`, { duration: 2000 });
            }
          }
        } catch {
          // 记录失败不阻塞用户体验
        }
        // 刷新统计
        loadData();
      } catch {
        toast.error("复制失败，请手动复制");
      } finally {
        setSharing(null);
      }
    },
    [status, router, shareUrl, shareText, loadData],
  );

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      toast.success("邀请码已复制");
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success("邀请链接已复制");
    }
  };

  // ── 加载态 ──────────────────────────────────────────────

  if (status === "loading" || loading) {
    return (
      <PageContainer maxWidth={1100}>
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
          <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 24 }} />
          <p style={{ marginTop: 12, fontSize: 13 }}>加载推广数据中…</p>
        </div>
      </PageContainer>
    );
  }

  // ── 主渲染 ──────────────────────────────────────────────

  const stats = data?.stats;
  const statCards: Array<{ value: string | number; label: string; icon: string; color?: string }> = [
    { value: stats?.shareCount ?? 0, label: "总分享次数", icon: "ti-share-3" },
    { value: stats?.totalClicks ?? 0, label: "点击访问", icon: "ti-mouse-click" },
    { value: stats?.teamCount ?? 0, label: "注册转化", icon: "ti-user-plus" },
    {
      value: `+${stats?.totalRewardPoints ?? 0}`,
      label: "已得星币",
      icon: "ti-coin",
      color: "var(--warning)",
    },
  ];

  return (
    <PageContainer maxWidth={1100}>
      {/* 标题 */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle as="h1" icon="ti-megaphone" title="推广中心" />
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          分享命盘或邀请链接 · 好友注册获 <strong style={{ color: "var(--brand)" }}>20 星币</strong> ·
          好友充值返 <strong style={{ color: "var(--brand)" }}>10%</strong>
        </p>
      </div>

      {/* 统计卡片 */}
      <div
        className="share-stats"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: 24 }}
      >
        {statCards.map((card) => (
          <div className="ss" key={card.label}>
            <div>
              <i className={`ti ${card.icon}`} style={{ fontSize: 18, color: card.color ?? "var(--brand)" }} />
            </div>
            <div className="ss-v" style={card.color ? { color: card.color } : undefined}>
              {card.value}
            </div>
            <div className="ss-l">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 邀请码 + 链接 */}
      <div
        className="card"
        style={{
          padding: 18,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 140 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>我的邀请码</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--brand)",
              fontFamily: "var(--font-head)",
              letterSpacing: 4,
            }}
          >
            {inviteCode || "—"}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>我的邀请链接</div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
              wordBreak: "break-all",
              background: "var(--soft)",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              marginTop: 4,
            }}
          >
            {shareUrl || "加载中…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopyCode}>
            <i className="ti ti-hash" style={{ marginRight: 4 }} /> 复制码
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyLink}>
            <i className="ti ti-copy" style={{ marginRight: 4 }} /> 复制链接
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          background: "var(--soft)",
          padding: 4,
          borderRadius: "var(--radius-sm)",
          width: "fit-content",
        }}
      >
        {[
          { key: "share", label: "分享渠道", icon: "ti-share-3" },
          { key: "team", label: `我的团队${stats?.teamCount ? ` (${stats.teamCount})` : ""}`, icon: "ti-users" },
          { key: "earnings", label: "收益明细", icon: "ti-coin" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: "8px 16px",
              background: activeTab === tab.key ? "var(--panel)" : "transparent",
              border: "none",
              borderBottom: activeTab === tab.key ? "2px solid var(--brand)" : "2px solid transparent",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: 13,
              color: activeTab === tab.key ? "var(--brand)" : "var(--text-muted)",
              fontWeight: activeTab === tab.key ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className={`ti ${tab.icon}`} style={{ fontSize: 14 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === "share" && (
        <>
          {/* 分享渠道 */}
          <SectionTitle icon="ti-world" title="分享渠道" />
          <div
            className="share-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 14,
              marginBottom: 24,
              marginTop: 12,
            }}
          >
            {CHANNELS.map((channel) => (
              <button
                key={channel.key}
                type="button"
                className="share-card"
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  padding: 18,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 6,
                  textAlign: "left",
                  boxShadow: "var(--shadow)",
                  opacity: sharing === channel.key ? 0.6 : 1,
                }}
                onClick={() => handleShare(channel)}
                disabled={sharing === channel.key}
              >
                <i
                  className={`ti ${channel.icon}`}
                  style={{
                    fontSize: 28,
                    color: channel.color || "var(--brand)",
                  }}
                />
                <h4 style={{ fontSize: 14, color: "var(--brand)", fontWeight: 600 }}>
                  {channel.label}
                </h4>
                <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {channel.desc}
                </p>
              </button>
            ))}
          </div>

          {/* 分享奖励规则 */}
          <SectionTitle icon="ti-gift" title="奖励规则" />
          <div className="help-note" style={{ marginTop: 12, marginBottom: 16 }}>
            <ul style={{ paddingLeft: 18, lineHeight: 1.9, marginTop: 0, marginBottom: 0 }}>
              <li>每次有效分享（点击访问）：<strong style={{ color: "var(--brand)" }}>+1 星币</strong></li>
              <li>好友通过你的邀请码注册：<strong style={{ color: "var(--brand)" }}>你 +20 星币</strong> · <strong style={{ color: "var(--brand)" }}>好友 +10 星币</strong></li>
              <li>好友首次及后续充值：额外获得充值金额 <strong style={{ color: "var(--brand)" }}>10%</strong> 的星币返点</li>
              <li>每日分享上限：<strong style={{ color: "var(--brand)" }}>10 次</strong>（防止刷币，超出不再奖励但仍记录）</li>
            </ul>
          </div>

          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid var(--line-light)",
            }}
          >
            <i className="ti ti-info-circle" style={{ marginRight: 4 }} />
            紫微问道禁止诱导分享与虚假宣传，违规账号将冻结星币与会员权益。
          </p>
        </>
      )}

      {activeTab === "team" && (
        <>
          <SectionTitle
            icon="ti-users"
            title={`我的团队（${stats?.teamCount ?? 0} 人）`}
          />
          <div className="card" style={{ marginTop: 12 }}>
            {team.length === 0 ? (
              <EmptyState
                icon="ti-users"
                title="还没有邀请到好友"
                description="复制邀请链接分享给好友吧"
              />
            ) : (
              <div className="log-list">
                {team.map((member) => (
                  <div key={member.id} className="log-item income">
                    <div
                      className="log-icon"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                      }}
                    >
                      {member.displayName.charAt(0)}
                    </div>
                    <div className="log-info">
                      <div className="log-title">{member.displayName}</div>
                      <div className="log-meta">
                        加入时间：{new Date(member.joinedAt).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                    <div className="log-amount">+{member.contributedPoints}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "earnings" && (
        <>
          <SectionTitle icon="ti-coin" title="收益明细" />
          <div className="card" style={{ marginTop: 12 }}>
            {earnings.length === 0 ? (
              <EmptyState
                icon="ti-receipt"
                title="暂无收益记录"
                description="分享给好友或邀请注册即可获得星币"
              />
            ) : (
              <div className="log-list">
                {earnings.map((e) => (
                  <div key={e.id} className="log-item income">
                    <div className="log-icon">
                      <i className={`ti ${e.eventType === "REGISTER" ? "ti-user-plus" : "ti-coin"}`} />
                    </div>
                    <div className="log-info">
                      <div className="log-title">{EVENT_LABELS[e.eventType] ?? e.eventType}</div>
                      <div className="log-meta">
                        {new Date(e.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <div className="log-amount">+{e.points}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
