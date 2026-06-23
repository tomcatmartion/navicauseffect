import Link from "next/link";

/**
 * 桌面端页脚（fixed 在视口底部，不随滚动消失）。
 *
 * - position: fixed，永远附在底部，不管页面滚到哪
 * - 高度紧凑（约 60px，原来约 180px 的三分之一）
 * - 只保留：免责声明（按用户最新文案）+ 底栏（ICP 备案 / 版权 / 投诉邮箱）
 * - 桌面端显示，移动端隐藏（H5 由 mobile-tabbar 占据底部）
 * - 配合 (main)/layout.tsx 给滚动区加 padding-bottom 让位
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="hidden md:block"
      style={{
        position: "fixed",
        bottom: 0,
        left: "84px",  /* 对应 .rail 宽度，避开左侧导航区 */
        right: 0,
        zIndex: 5,
        background: "var(--bg)",
        padding: "10px 32px",
        color: "var(--text-muted)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* 第一行：免责声明 */}
        <p style={{ fontSize: 11, lineHeight: 1.5, margin: 0, textAlign: "center" }}>
          <strong style={{ color: "var(--ink)", marginRight: 4 }}>免责声明：</strong>
          本平台提供的命理分析与心理建议仅供参考，旨在帮助您进行自我探索与反思。AI 工具的回答存在一定的幻觉，不构成任何医疗、心理诊断或投资建议。如需其它帮助，请及时寻求专业人士帮助。
        </p>

        {/* 第二行：ICP + 版权 + 投诉邮箱 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            fontSize: 11,
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
      </div>
    </footer>
  );
}
