"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * 捕获 URL ?ref=XXXX 邀请码，存入 localStorage + cookie（30 天）。
 * 注册时表单会读取并附在 body.inviteCode，触发邀请奖励。
 *
 * try-catch 防 ad-blocker 阻止 localStorage / cookie 写入。
 */
function useRefCapture() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    try {
      localStorage.setItem("pendingInviteCode", ref.toUpperCase());
    } catch {
      /* ignore */
    }
    try {
      document.cookie = `pendingInviteCode=${ref.toUpperCase()}; max-age=2592000; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, [searchParams]);
}

// 首页 4 大核心功能（对照 Downloads/index.html mockup）
const FEATURES = [
  {
    title: "精准排盘",
    desc: "生辰信息秒速生成个人命盘",
    icon: "ti-spiral",
  },
  {
    title: "关系分析",
    desc: "太岁入卦，洞察人际相处之道",
    icon: "ti-users",
  },
  {
    title: "行运解读",
    desc: "大限流年，把握当下时机",
    icon: "ti-trending-up",
  },
  {
    title: "知识体系",
    desc: "星曜宫位，由浅入深系统学习",
    icon: "ti-books",
  },
] as const;

// 首页 tag（对照 mockup）
const TAGS = ["紫云派斗数", "太岁入卦法", "AI 深度解读", "性格为底 · 行运为表"] as const;

// 已登录快捷入口（保留原逻辑）
const QUICK_ENTRIES = [
  {
    href: "/chart",
    title: "新建排盘",
    desc: "输入出生信息，生成紫微命盘",
    icon: "ti-plus",
    color: "var(--brand)",
  },
  {
    href: "/charts",
    title: "我的命盘",
    desc: "查看已保存的命盘档案",
    icon: "ti-clipboard-list",
    color: "var(--accent)",
  },
  {
    href: "/reports",
    title: "命理报告",
    desc: "生成或查看深度分析报告",
    icon: "ti-file-text",
    color: "var(--accent2)",
  },
  {
    href: "/compatibility",
    title: "双人合盘",
    desc: "分析你与他人的互动关系",
    icon: "ti-hearts",
    color: "var(--warning)",
  },
  {
    href: "/promoter",
    title: "推广得币",
    desc: "邀请好友注册获得星币",
    icon: "ti-megaphone",
    color: "var(--success)",
  },
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;
  useRefCapture();

  // 加载中：显示原 hero（避免水合不匹配）
  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: "var(--brand)" }} />
      </div>
    );
  }

  // 已登录：快捷入口 + 问候
  if (isLoggedIn) {
    const hour = new Date().getHours();
    const greeting = hour < 6 ? "夜安" : hour < 11 ? "早安" : hour < 14 ? "午安" : hour < 18 ? "下午好" : hour < 22 ? "晚上好" : "夜深了";
    const nickname = session?.user?.name || "朋友";

    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* 问候 */}
        <div
          className="card"
          style={{
            padding: 24,
            marginBottom: 24,
            background: "linear-gradient(135deg, var(--soft), var(--panel))",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: 2 }}>
            <i className="ti ti-home" style={{ marginRight: 6 }} />
            WELCOME BACK
          </div>
          <h2
            style={{
              fontSize: 28,
              color: "var(--brand)",
              fontFamily: "var(--font-head)",
              fontWeight: 700,
              marginTop: 6,
            }}
          >
            {greeting}，{nickname}
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-light)", marginTop: 6 }}>
            继续探索你的命盘，或开启一段新的咨询
          </p>
        </div>

        {/* 快捷入口 */}
        <h3
          className="home-section-title"
          style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12 }}
        >
          <i className="ti ti-bolt" style={{ marginRight: 6 }} />
          快捷入口
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 24,
          }}
        >
          {QUICK_ENTRIES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="card"
              style={{
                padding: 18,
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <i
                className={`ti ${entry.icon}`}
                style={{ fontSize: 26, color: entry.color }}
              />
              <div
                style={{
                  fontSize: 14,
                  color: "var(--brand)",
                  fontWeight: 600,
                  fontFamily: "var(--font-head)",
                }}
              >
                {entry.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                {entry.desc}
              </div>
            </Link>
          ))}
        </div>

        {/* 4 大核心功能（对照 mockup） */}
        <h3
          className="home-section-title"
          style={{ fontSize: 15, color: "var(--brand)", marginBottom: 12, marginTop: 28 }}
        >
          <i className="ti ti-sparkles" style={{ marginRight: 6 }} />
          核心功能
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="card" style={{ padding: 18, textAlign: "center" }}>
              <i
                className={`ti ${f.icon}`}
                style={{ fontSize: 26, color: "var(--brand)", display: "block", marginBottom: 10 }}
              />
              <h4
                style={{
                  fontSize: 14,
                  color: "var(--brand)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {f.title}
              </h4>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // 未登录：对照 Downloads/index.html 首页内容
  //   顶部品牌条 · 大字 slogan · 装饰线 · 紫云理念描述 · 4 tag · 2 CTA · 4 features
  // ────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%" }}>
      {/* Hero（首页主视觉） */}
      <section
        style={{
          position: "relative",
          textAlign: "center",
          padding: "48px 24px 12px",
          overflow: "hidden",
        }}
      >
        {/* 背景径向光晕 */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 42%, rgba(139, 111, 71, 0.09), transparent 62%)",
          }}
        />

        {/* 顶部品牌条：微著 | 传统斗数 */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 36 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--brand)",
                letterSpacing: 4,
                fontFamily: "var(--font-head)",
              }}
            >
              微著
            </span>
            <span
              style={{
                display: "inline-block",
                width: 1,
                height: 20,
                background: "var(--line)",
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                letterSpacing: 3,
              }}
            >
              传统斗数
            </span>
          </span>
        </div>

        {/* 大字 slogan */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "var(--brand)",
              fontFamily: "var(--font-head)",
              lineHeight: 1.5,
              letterSpacing: 6,
              margin: 0,
            }}
          >
            <span style={{ display: "block" }}>观己 观人 观世界</span>
            <span style={{ display: "block" }}>知微 知著 知真如</span>
          </h1>

          {/* 装饰线 + 菱形印章 */}
          <div
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              margin: "22px 0 4px",
            }}
          >
            <span
              style={{
                width: 72,
                height: 1,
                background: "linear-gradient(90deg, transparent, var(--line))",
              }}
            />
            <span
              style={{
                width: 9,
                height: 9,
                border: "1px solid var(--line)",
                transform: "rotate(45deg)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: 72,
                height: 1,
                background: "linear-gradient(90deg, var(--line), transparent)",
              }}
            />
          </div>

          {/* 紫云理念描述 */}
          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              lineHeight: 2,
              maxWidth: 600,
              margin: "18px auto 0",
            }}
          >
            秉承紫云老师传统斗数理念
            <br />
            以太岁入卦法厘清人与人之间的关系——亲子、感情、合作、职场。
            <br />
            性格为底，行运为表，结合你的实际处境，解答当下疑惑。
          </p>

          {/* 4 个 tag */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
              margin: "24px 0 30px",
            }}
          >
            {TAGS.map((t) => (
              <span
                key={t}
                className="chip"
                style={{
                  fontSize: 12,
                  padding: "6px 14px",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 20,
                  color: "var(--brand)",
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* 2 CTA */}
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 44,
            }}
          >
            <Link href="/chart">
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 15, padding: "13px 32px" }}
              >
                <i className="ti ti-spiral" style={{ marginRight: 6 }} />
                开始排盘
              </button>
            </Link>
            <a href="#features">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 15, padding: "13px 32px" }}
              >
                <i className="ti ti-books" style={{ marginRight: 6 }} />
                了解斗数
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* 4 大核心功能 */}
      <section
        id="features"
        style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px", scrollMarginTop: 80 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card"
              style={{
                padding: "22px 14px",
                textAlign: "center",
                transition: "transform .2s, border-color .2s",
              }}
            >
              <i
                className={`ti ${f.icon}`}
                style={{
                  fontSize: 28,
                  color: "var(--brand)",
                  display: "block",
                  marginBottom: 10,
                }}
              />
              <h4
                style={{
                  fontSize: 14,
                  color: "var(--brand)",
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                {f.title}
              </h4>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 底部 CTA */}
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
            无需付费，即刻体验紫微排盘与 AI 智能解析
          </p>
          <Link href="/chart">
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 15, padding: "12px 36px" }}
            >
              免费体验
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
