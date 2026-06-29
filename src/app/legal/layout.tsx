import Link from "next/link";

/**
 * /legal/* 路由组布局：独立于 (main) 与 (admin)，不带 Rail/Tabbar。
 * 用于用户协议、隐私政策等静态法律信息页，保证极简、可打印、无干扰。
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg, #f7f5f0)",
        color: "var(--ink, #2a2520)",
        fontFamily: "var(--font-sans-sc, -apple-system, sans-serif)",
      }}
    >
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--line, #e8e0d3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--panel, #fff)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: "var(--brand, #8b6f47)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          <i className="ti ti-arrow-left" />
          返回紫微问道
        </Link>
        <nav style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <Link
            href="/legal/terms"
            style={{ color: "var(--text-muted, #888)", textDecoration: "none" }}
          >
            用户协议
          </Link>
          <Link
            href="/legal/privacy"
            style={{ color: "var(--text-muted, #888)", textDecoration: "none" }}
          >
            隐私政策
          </Link>
        </nav>
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px" }}>
        {children}
      </main>
    </div>
  );
}
