"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ShareChannel {
  key: string;
  label: string;
  desc: string;
  icon: string;
  color?: string;
  /** web 端实际行为：'copy' 复制链接，'intent' 用 url scheme，'toast' 仅提示 */
  action: "copy" | "intent" | "toast";
  intentUrl?: string;
}

const CHANNELS: ShareChannel[] = [
  {
    key: "wechat",
    label: "微信好友",
    desc: "复制链接后粘贴给微信好友",
    icon: "ti-brand-wechat",
    color: "#07c160",
    action: "copy",
  },
  {
    key: "moments",
    label: "朋友圈",
    desc: "复制链接 + 推荐文案发朋友圈",
    icon: "ti-device-imessage",
    color: "#07c160",
    action: "copy",
  },
  {
    key: "weibo",
    label: "新浪微博",
    desc: "跳转微博分享",
    icon: "ti-brand-weibo",
    color: "#e6162d",
    action: "intent",
    intentUrl: "https://service.weibo.com/share/share.php",
  },
  {
    key: "qq",
    label: "QQ",
    desc: "跳转 QQ 分享",
    icon: "ti-brand-qq",
    color: "#12b7f5",
    action: "intent",
    intentUrl: "https://connect.qq.com/widget/shareqq/index.html",
  },
  {
    key: "link",
    label: "复制链接",
    desc: "复制专属邀请链接",
    icon: "ti-link",
    action: "copy",
  },
  {
    key: "qrcode",
    label: "二维码",
    desc: "生成二维码图片",
    icon: "ti-qrcode",
    action: "toast",
  },
  {
    key: "redbook",
    label: "小红书",
    desc: "复制推荐文案（手动发布）",
    icon: "ti-brand-redhat",
    color: "#ff2741",
    action: "toast",
  },
  {
    key: "zhihu",
    label: "知乎",
    desc: "跳转知乎",
    icon: "ti-brand-zhihu",
    color: "#0084ff",
    action: "toast",
  },
];

export default function SharePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sharing, setSharing] = useState<string | null>(null);

  const inviteCode = session?.user?.id ? session.user.id.slice(0, 8).toUpperCase() : "ZIWEI";
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${inviteCode}`
      : `https://ziwei.app/?ref=${inviteCode}`;
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
        // 记录分享到后端（+1 星币）
        try {
          await fetch("/api/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel: channel.key }),
          });
        } catch {
          // 记录失败不阻塞用户体验
        }
      } catch (e) {
        toast.error("复制失败，请手动复制");
      } finally {
        setSharing(null);
      }
    },
    [status, router, shareUrl, shareText],
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 60px" }}>
      {/* 标题 */}
      <div style={{ marginBottom: 20 }}>
        <h2
          className="home-section-title"
          style={{ margin: 0, fontSize: 18, color: "var(--brand)", fontFamily: "var(--font-head)" }}
        >
          <i className="ti ti-share-3" style={{ marginRight: 8 }} />
          分享中心
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          分享命盘或邀请链接，好友注册后你可获得 <strong style={{ color: "var(--brand)" }}>5 星币</strong> 奖励
        </p>
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
        <div>
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
            {inviteCode}
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
            {shareUrl}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            toast.success("邀请链接已复制");
          }}
        >
          <i className="ti ti-copy" style={{ marginRight: 6 }} />
          复制链接
        </button>
      </div>

      {/* 分享渠道 */}
      <h3
        className="home-section-title"
        style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
      >
        <i className="ti ti-world" style={{ marginRight: 6 }} />
        分享渠道
      </h3>
      <div
        className="share-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 24,
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
      <h3
        className="home-section-title"
        style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
      >
        <i className="ti ti-coin" style={{ marginRight: 6 }} />
        奖励规则
      </h3>
      <div className="help-note" style={{ marginBottom: 16 }}>
        <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
          <li>每次有效分享（点击访问）：<strong style={{ color: "var(--brand)" }}>+1 星币</strong></li>
          <li>好友通过你的链接注册：<strong style={{ color: "var(--brand)" }}>+5 星币</strong></li>
          <li>好友首次充值：额外获得充值金额 <strong style={{ color: "var(--brand)" }}>10%</strong> 的星币奖励</li>
          <li>每日分享上限：<strong style={{ color: "var(--brand)" }}>10 次</strong>（防止刷币）</li>
        </ul>
      </div>

      {/* 免责 */}
      <p
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textAlign: "center",
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid var(--line-light)",
        }}
      >
        紫微问道禁止诱导分享与虚假宣传，违规账号将冻结星币与会员权益。
      </p>
    </div>
  );
}
