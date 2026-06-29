"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRecentCharts, type RecentChart } from "@/lib/utils/recent-charts";
import {
  OnboardingDialog,
  isOnboardingCompleted,
} from "@/components/shared/onboarding-dialog";

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

// 首页 6 大核心功能（描述文字对照旧版首页，视觉用新版 testUI 规范）
const FEATURES = [
  {
    title: "命理排盘",
    desc: "基于紫微斗数精准排盘，生成命盘、大限盘、流年盘，支持阴历/阳历与真太阳时自动校正",
    icon: "ti-spiral",
  },
  {
    title: "AI 对话",
    desc: "四大顶尖 AI 大模型深度解读命盘，融合紫微智慧与心理学视角，给出全方位分析",
    icon: "ti-brain",
  },
  {
    title: "性格分析",
    desc: "从命宫主星解读你的性格密码，结合大五人格理论，帮助你更好地认识自己",
    icon: "ti-user-search",
  },
  {
    title: "感情婚姻",
    desc: "夫妻宫与桃花星深度分析，结合依恋理论，为你的感情生活提供温暖指引",
    icon: "ti-hearts",
  },
  {
    title: "事业财运",
    desc: "官禄宫与财帛宫联合解读，结合职业心理学，助你找到事业发展最优路径",
    icon: "ti-trending-up",
  },
  {
    title: "情绪疏导",
    desc: "福德宫分析内在情绪模式，融合认知行为疗法，提供专业的心理疏导建议",
    icon: "ti-mood-zen",
  },
] as const;

// 首页 tag（对照 mockup）
const TAGS = ["紫云派斗数", "太岁入卦法", "AI 深度解读", "性格为底 · 行运为表"] as const;

// 已登录快捷入口（B-14：移动端强化，加入会员入口）
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
    href: "/pricing",
    title: "会员充值",
    desc: "开通会员或购买星币",
    icon: "ti-crown",
    color: "var(--brand)",
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
  // S-06：最近访问命盘
  const [recents, setRecents] = useState<RecentChart[]>([]);
  // S-01：新用户 Onboarding 引导
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    setRecents(getRecentCharts());
    // 已登录但未完成引导 → 触发
    if (!isOnboardingCompleted()) {
      // 延迟 1s 避免与首页 hero 渲染抢焦点
      const t = setTimeout(() => setShowOnboarding(true), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isLoggedIn]);

  // 加载中：显示原 hero（避免水合不匹配）
  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 28, color: "var(--brand)" }} />
      </div>
    );
  }

  // 已登录：与未登录视觉一致(光晕 + 大字 slogan + 装饰线 + tag),中间区改为快捷入口 chip
  if (isLoggedIn) {
    const hour = new Date().getHours();
    const greeting = hour < 6 ? "夜安" : hour < 11 ? "早安" : hour < 14 ? "午安" : hour < 18 ? "下午好" : hour < 22 ? "晚上好" : "夜深了";
    const nickname = session?.user?.name || "朋友";

    return (
      <div style={{ width: "100%" }}>
        <section
          style={{
            position: "relative",
            textAlign: "center",
            padding: "56px 24px 0",
            overflow: "hidden",
          }}
        >
          {/* 背景径向光晕(同未登录) */}
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

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* 个性化问候(小字 letter-spacing,位于 slogan 上方) */}
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                letterSpacing: 3,
                margin: "0 0 14px",
              }}
            >
              <i className="ti ti-home" style={{ marginRight: 6 }} />
              {greeting} · {nickname}
            </p>

            {/* 大字 slogan(同未登录) */}
            <h1
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "var(--brand)",
                fontFamily: "var(--font-head)",
                lineHeight: 1.5,
                letterSpacing: 7,
                margin: 0,
              }}
            >
              <span style={{ display: "block" }}>观己 观人 观世界</span>
              <span style={{ display: "block" }}>知微 知著 知真如</span>
            </h1>

            {/* 装饰线 + 菱形印章(同未登录) */}
            <div
              aria-hidden
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                margin: "26px 0 4px",
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

            {/* 续句(替换紫云理念描述,个性化) */}
            <p
              style={{
                fontSize: 15,
                color: "var(--text-muted)",
                lineHeight: 2,
                maxWidth: 600,
                margin: "22px auto 0",
              }}
            >
              继续探索你的命盘，或开启一段新的咨询
              <br />
              性格为底，行运为表，结合你的实际处境，解答当下疑惑。
            </p>

            {/* 4 个 tag(同未登录) */}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
                margin: "26px 0 34px",
              }}
            >
              {TAGS.map((t) => (
                <span
                  key={t}
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

            {/* 6 快捷入口 chip（B-14：移动端强化，含合盘/会员/推广；响应式 grid） */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                maxWidth: 720,
                margin: "0 auto 52px",
              }}
            >
              {QUICK_ENTRIES.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderRadius: 24,
                      cursor: "pointer",
                      transition: "border-color .2s, transform .15s",
                    }}
                  >
                    <i
                      className={`ti ${entry.icon}`}
                      style={{ fontSize: 16, color: entry.color }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--brand)",
                        fontWeight: 500,
                        fontFamily: "var(--font-head)",
                      }}
                    >
                      {entry.title}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* S-06：最近访问命盘（仅在有记录时显示） */}
            {recents.length > 0 && (
              <div style={{ maxWidth: 720, margin: "0 auto 40px", padding: "0 24px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 10,
                    color: "var(--text-muted)",
                    fontSize: 12,
                    fontFamily: "var(--font-head)",
                  }}
                >
                  <i className="ti ti-history" style={{ fontSize: 14 }} />
                  最近访问
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {recents.slice(0, 5).map((r) => (
                    <Link
                      key={r.id}
                      href={`/charts/${r.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        className="chip"
                        style={{
                          cursor: "pointer",
                          background: "var(--soft)",
                          color: "var(--ink)",
                          border: "1px solid var(--line-light)",
                          padding: "5px 12px",
                          fontSize: 12,
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.name}
                      >
                        <i
                          className="ti ti-clipboard-list"
                          style={{ marginRight: 4, fontSize: 11, color: "var(--brand)" }}
                        />
                        {r.name}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 6 大核心功能(同未登录,3 列 grid,maxWidth 960) */}
        <section
          id="features"
          style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px", scrollMarginTop: 80 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
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
                    fontSize: 26,
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
        </section>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // 未登录：对照 ~/Downloads/index.html 首页内容
  //   大字 slogan · 装饰线 · 紫云理念描述 · 4 tag · 2 CTA · 4 features
  // ────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%" }}>
      <section
        style={{
          position: "relative",
          textAlign: "center",
          padding: "56px 24px 0",
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

        <div style={{ position: "relative", zIndex: 1 }}>
          {/* 大字 slogan */}
          <h1
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "var(--brand)",
              fontFamily: "var(--font-head)",
              lineHeight: 1.5,
              letterSpacing: 7,
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
              margin: "26px 0 4px",
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
              fontSize: 15,
              color: "var(--text-muted)",
              lineHeight: 2,
              maxWidth: 600,
              margin: "22px auto 0",
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
              margin: "26px 0 34px",
            }}
          >
            {TAGS.map((t) => (
              <span
                key={t}
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
              marginBottom: 52,
            }}
          >
            <Link href="/chart">
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 15, padding: "13px 32px" }}
              >
                开始排盘
              </button>
            </Link>
            <a href="#features">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 15, padding: "13px 32px" }}
              >
                了解斗数
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* 6 大核心功能（描述对照旧版首页） */}
      <section
        id="features"
        style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 60px", scrollMarginTop: 80 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
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
                  fontSize: 26,
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
      </section>

      {/* S-01：新用户 Onboarding 弹层 */}
      <OnboardingDialog
        open={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
    </div>
  );
}
