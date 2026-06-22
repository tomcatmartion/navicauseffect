/**
 * SectionTitle — 区块标题
 *
 * 提炼自 / /charts 的 .home-section-title 用法。
 * 配合 ziwei.css 中已定义的 .home-section-title 类。
 *
 * 使用：
 *   <SectionTitle icon="ti-history" title="最近命盘" />
 *   <SectionTitle icon="ti-file-text" title="我的报告" extra={<Link href="/reports">全部</Link>} />
 */

import { type ReactNode } from "react";

interface SectionTitleProps {
  /** Tabler 图标名（不含 ti 前缀） */
  icon?: string;
  title: string;
  /** 右侧附加区（链接、按钮等） */
  extra?: ReactNode;
  /** HTML 标签，默认 h2 */
  as?: "h1" | "h2" | "h3";
}

export function SectionTitle({
  icon,
  title,
  extra,
  as: Tag = "h2",
}: SectionTitleProps) {
  return (
    <div
      className="home-section-title"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
    >
      <Tag style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", color: "inherit" }}>
        {icon && <i className={`ti ti-${icon}`} aria-hidden style={{ marginRight: 8 }} />}
        {title}
      </Tag>
      {extra && <div>{extra}</div>}
    </div>
  );
}
