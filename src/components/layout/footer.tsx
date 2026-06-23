import Link from "next/link";

/**
 * 桌面端页脚（含 ICP 备案号）。
 *
 * - 桌面端（md 以上）显示，移动端隐藏（H5 由 mobile-tabbar 占据底部）
 * - testUI 风格：用 CSS 变量 + .card / .chip 类，避免 shadcn 残留
 * - 放在 (main)/layout.tsx 的滚动区底部，所有页面共享
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="hidden md:block"
      style={{
        borderTop: "1px solid var(--line)",
        background: "var(--soft)",
        padding: "28px 32px 20px",
        marginTop: "40px",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1.5fr",
          gap: 28,
        }}
      >
        {/* 品牌标语 */}
        <div>
          <div
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 16,
              color: "var(--brand)",
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            微著
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.8, margin: 0 }}>
            观己观人观世界
            <br />
            知微知著知真如
          </p>
          <p style={{ fontSize: 11, marginTop: 8, lineHeight: 1.7, opacity: 0.85 }}>
            紫微斗数 × 心理科学融合的命理咨询平台
          </p>
        </div>

        {/* 快速链接 */}
        <div>
          <h4
            style={{
              fontSize: 12,
              color: "var(--ink)",
              fontWeight: 600,
              marginBottom: 10,
              letterSpacing: 1,
            }}
          >
            服务
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
            <Link href="/chart" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              <i className="ti ti-message-2" style={{ marginRight: 6 }} />
              AI 对话
            </Link>
            <Link href="/charts" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              <i className="ti ti-clipboard-list" style={{ marginRight: 6 }} />
              我的命盘
            </Link>
            <Link href="/pricing" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              <i className="ti ti-crown" style={{ marginRight: 6 }} />
              会员服务
            </Link>
            <Link href="/promoter" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              <i className="ti ti-megaphone" style={{ marginRight: 6 }} />
              推广中心
            </Link>
          </div>
        </div>

        {/* 免责声明 */}
        <div>
          <h4
            style={{
              fontSize: 12,
              color: "var(--ink)",
              fontWeight: 600,
              marginBottom: 10,
              letterSpacing: 1,
            }}
          >
            免责声明
          </h4>
          <p style={{ fontSize: 11, lineHeight: 1.7, margin: 0 }}>
            本平台提供的命理分析与心理建议仅供参考，旨在帮助您进行自我探索与反思，
            不构成任何医疗、心理诊断或投资建议。如有严重心理困扰，请及时寻求专业人士帮助。
          </p>
        </div>
      </div>

      {/* 底栏：ICP + 版权 */}
      <div
        style={{
          maxWidth: 1100,
          margin: "20px auto 0",
          paddingTop: 14,
          borderTop: "1px solid var(--line-light)",
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>© {year} 微著 · All rights reserved.</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          辽ICP备2026007904号
        </a>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>
          投诉建议：
          <a
            href="mailto:support@ziyunpai.com"
            style={{ color: "var(--brand)", textDecoration: "underline", textUnderlineOffset: 3 }}
          >
            support@ziyunpai.com
          </a>
        </span>
      </div>
    </footer>
  );
}
