"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

const features = [
  {
    title: "命理排盘",
    desc: "基于紫微斗数精准排盘，生成命盘、大限盘、流年盘，支持阴历/阳历与真太阳时自动校正",
    icon: "☯",
  },
  {
    title: "AI 智能解析",
    desc: "四大顶尖 AI 大模型深度解读命盘，融合紫微智慧与心理学视角，给出全方位分析",
    icon: "🧠",
  },
  {
    title: "性格分析",
    desc: "从命宫主星解读你的性格密码，结合大五人格理论，帮助你更好地认识自己",
    icon: "🔮",
  },
  {
    title: "感情婚姻",
    desc: "夫妻宫与桃花星深度分析，结合依恋理论，为你的感情生活提供温暖指引",
    icon: "💕",
  },
  {
    title: "事业财运",
    desc: "官禄宫与财帛宫联合解读，结合职业心理学，助你找到事业发展最优路径",
    icon: "📈",
  },
  {
    title: "情绪疏导",
    desc: "福德宫分析内在情绪模式，融合认知行为疗法，提供专业的心理疏导建议",
    icon: "🌿",
  },
];

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
    href: "/share",
    title: "分享得币",
    desc: "邀请好友注册获得星币",
    icon: "ti-share-3",
    color: "var(--success)",
  },
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;

  // 加载中：显示原 hero（避免水合不匹配）
  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Loader2 className="size-8 animate-spin" style={{ color: "var(--brand)" }} />
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

        {/* 功能介绍（折叠区） */}
        <details style={{ marginTop: 12 }}>
          <summary
            style={{
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text-muted)",
              padding: "10px 0",
            }}
          >
            <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
            了解紫微问道完整功能
          </summary>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="card"
                style={{ padding: 16 }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                <h4
                  style={{
                    fontSize: 14,
                    color: "var(--brand)",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {f.title}
                </h4>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  }

  // 未登录：原 hero + features + CTA
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(139, 26, 26, 0.05), transparent)",
        }}
      >
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center md:py-24">
          <p
            className="mb-4 text-xs tracking-[0.3em]"
            style={{ color: "var(--text-muted)" }}
          >
            传统智慧 × 现代科学
          </p>
          <h1
            className="font-serif-sc mb-2 text-4xl font-bold leading-tight md:text-6xl"
            style={{ color: "var(--brand)" }}
          >
            观己观人观世界
          </h1>
          <h2
            className="font-serif-sc mb-8 text-4xl font-bold leading-tight md:text-6xl"
            style={{ color: "var(--brand)" }}
          >
            知微知著知真如
          </h2>
          <p
            className="mx-auto mb-10 max-w-2xl text-base leading-relaxed md:text-lg"
            style={{ color: "var(--text-muted)" }}
          >
            古老的紫微斗数解码生命轨迹，现代心理科学洞察情绪密码。
            透过星盘与数据，提供经过双重验证的人生优化方案。
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/chart">
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 16, padding: "12px 32px" }}
              >
                立即排盘
              </button>
            </Link>
            <Link href="/pricing">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 16, padding: "12px 32px" }}
              >
                了解会员
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2
            className="font-serif-sc mb-3 text-2xl font-bold md:text-3xl"
            style={{ color: "var(--brand)" }}
          >
            核心服务
          </h2>
          <p style={{ color: "var(--text-muted)" }}>
            从命理智慧到心理科学，全方位守护你的人生旅程
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="card"
              style={{ padding: 24, transition: "transform .15s, border-color .2s" }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                style={{ background: "var(--soft)", color: "var(--brand)" }}
              >
                {f.icon}
              </div>
              <h3
                className="mb-2 text-lg font-semibold"
                style={{ color: "var(--brand)" }}
              >
                {f.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background:
            "linear-gradient(90deg, rgba(139, 26, 26, 0.05), rgba(44, 74, 30, 0.08))",
        }}
      >
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:py-20">
          <h2
            className="font-serif-sc mb-4 text-2xl font-bold md:text-3xl"
            style={{ color: "var(--brand)" }}
          >
            开启你的自我探索之旅
          </h2>
          <p className="mb-8" style={{ color: "var(--text-muted)" }}>
            无需付费，即刻体验紫微排盘与 AI 智能解析
          </p>
          <Link href="/chart">
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 16, padding: "12px 40px" }}
            >
              免费体验
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
