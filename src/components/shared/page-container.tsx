/**
 * PageContainer — 业务页统一外壳
 *
 * 提炼自 / /chart /charts /charts/[id] 四个已标准化页面：
 *   <div style={{ maxWidth: 900-1100, margin: "0 auto", padding: "20/24px 24px 60px" }}>
 *
 * 使用：
 *   <PageContainer>...</PageContainer>
 *   <PageContainer maxWidth={1100}>...</PageContainer>
 *   <PageContainer as="section">...</PageContainer>
 */

import { type ElementType, type CSSProperties, type ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  /** 最大宽度，默认 1100 */
  maxWidth?: number;
  /** 顶部 padding，默认 24 */
  paddingTop?: number;
  /** 元素类型，默认 div */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

export function PageContainer({
  children,
  maxWidth = 1100,
  paddingTop = 24,
  as: Tag = "div",
  className,
  style,
}: PageContainerProps) {
  return (
    <Tag
      className={className}
      style={{
        maxWidth,
        margin: "0 auto",
        padding: `${paddingTop}px 24px 60px`,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
