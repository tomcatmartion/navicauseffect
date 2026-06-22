"use client";

import { useTheme, type ZiweiTheme } from "@/components/providers/theme-provider";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";

const THEME_OPTIONS: { key: ZiweiTheme; label: string; desc: string; color: string }[] = [
  {
    key: "newspaper",
    label: "报纸主题",
    desc: "米黄 + 朱砂 · 圆角 4px · 东方典雅",
    color: "#F2ECD9",
  },
  {
    key: "clay",
    label: "粘土风",
    desc: "暖米色 + 棕褐 · 圆角 14-30px · 柔和浮雕",
    color: "#F5F2EF",
  },
  {
    key: "neumorphism",
    label: "新拟态",
    desc: "冷灰 + 蓝青 · 圆角 10-24px · 极简",
    color: "#E0E5EC",
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { data: session } = useSession();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 24px 60px" }}>
      {/* 标题 */}
      <div style={{ marginBottom: 20 }}>
        <h2
          className="home-section-title"
          style={{ margin: 0, fontSize: 18, color: "var(--brand)", fontFamily: "var(--font-head)" }}
        >
          <i className="ti ti-settings" style={{ marginRight: 8 }} />
          账户设置
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          主题、偏好、通知与隐私
        </p>
      </div>

      {/* 主题切换 */}
      <h3
        className="home-section-title"
        style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
      >
        <i className="ti ti-palette" style={{ marginRight: 6 }} />
        主题外观
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {THEME_OPTIONS.map((opt) => {
          const active = theme === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              className="card"
              style={{
                padding: 16,
                cursor: "pointer",
                textAlign: "left",
                border: active
                  ? "2px solid var(--brand)"
                  : "1px solid var(--line)",
                background: active ? "var(--soft)" : "var(--panel)",
              }}
              onClick={() => {
                setTheme(opt.key);
                toast.success(`已切换到${opt.label}`);
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: opt.color,
                    border: "1px solid var(--line)",
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--brand)",
                    fontWeight: 600,
                    fontFamily: "var(--font-head)",
                  }}
                >
                  {opt.label}
                  {active && (
                    <i
                      className="ti ti-check"
                      style={{ marginLeft: 6, color: "var(--success)" }}
                    />
                  )}
                </span>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* 偏好设置 */}
      <h3
        className="home-section-title"
        style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
      >
        <i className="ti ti-adjustments" style={{ marginRight: 6 }} />
        偏好
      </h3>
      <div style={{ marginBottom: 24 }}>
        {[
          {
            icon: "ti-language",
            title: "语言",
            desc: "简体中文（暂不支持其它语言）",
            value: "zh-CN",
          },
          {
            icon: "ti-clock-hour-4",
            title: "时区",
            desc: "Asia/Shanghai (UTC+8)",
            value: "auto",
          },
          {
            icon: "ti-calendar-event",
            title: "默认历法",
            desc: "阳历（公历）",
            value: "solar",
          },
        ].map((row) => (
          <div
            key={row.title}
            className="setting-row"
            style={{ margin: 0, marginBottom: 8 }}
          >
            <span className="sr-l">
              <span className="sr-icon">
                <i className={`ti ${row.icon}`} />
              </span>
              <span>
                <span className="sr-title">{row.title}</span>
                <span className="sr-desc">{row.desc}</span>
              </span>
            </span>
            <span className="sr-r">{row.value}</span>
            <i className="ti ti-chevron-right" />
          </div>
        ))}
      </div>

      {/* 账户 */}
      <h3
        className="home-section-title"
        style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
      >
        <i className="ti ti-user" style={{ marginRight: 6 }} />
        账户
      </h3>
      <div style={{ marginBottom: 24 }}>
        <div
          className="setting-row"
          style={{ margin: 0, marginBottom: 8 }}
          onClick={() => router.push("/profile")}
        >
          <span className="sr-l">
            <span className="sr-icon">
              <i className="ti ti-id-badge-2" />
            </span>
            <span>
              <span className="sr-title">个人资料</span>
              <span className="sr-desc">{session?.user?.name || "未登录"}</span>
            </span>
          </span>
          <i className="ti ti-chevron-right" />
        </div>
        <div
          className="setting-row"
          style={{ margin: 0, marginBottom: 8 }}
          onClick={() => router.push("/pricing")}
        >
          <span className="sr-l">
            <span className="sr-icon">
              <i className="ti ti-crown" />
            </span>
            <span>
              <span className="sr-title">会员与充值</span>
              <span className="sr-desc">管理订阅、星币余额</span>
            </span>
          </span>
          <i className="ti ti-chevron-right" />
        </div>
        <div
          className="setting-row"
          style={{ margin: 0, marginBottom: 8 }}
          onClick={() => {
            if (confirm("确定退出登录？")) {
              signOut({ callbackUrl: "/" });
            }
          }}
        >
          <span className="sr-l">
            <span className="sr-icon">
              <i className="ti ti-logout" />
            </span>
            <span>
              <span className="sr-title" style={{ color: "var(--danger)" }}>
                退出登录
              </span>
              <span className="sr-desc">切换账户或重新登录</span>
            </span>
          </span>
          <i className="ti ti-chevron-right" />
        </div>
      </div>

      {/* 关于 */}
      <h3
        className="home-section-title"
        style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
      >
        <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
        关于
      </h3>
      <div className="help-note">
        <b>紫微问道 · v2.0</b>
        <br />
        以紫微斗数与心理科学相融合，传统智慧指引方向，科学方法疏导心结。
        <br />
        <br />
        反馈邮箱：support@ziyunpai.com
        <br />
        备案号：辽ICP备2026007904号-1
      </div>
    </div>
  );
}
