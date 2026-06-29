"use client";

import type { CSSProperties, ReactNode } from "react";

type LoadingVariant = "spinner" | "pulse" | "skeleton";
type LoadingSize = "sm" | "md" | "lg";

interface LoadingSkeletonProps {
  /** 展示形态：
   *  - spinner：图标 + 文字（最常用，替代散落的 ti-loader-2 ti-spin）
   *  - pulse：脉冲文字（适合"加载中..."文案场景）
   *  - skeleton：骨架屏区块（需配合 lineCount 使用）
   */
  variant?: LoadingVariant;
  /** 尺寸：sm=14px / md=20px / lg=28px（仅 spinner/pulse 生效） */
  size?: LoadingSize;
  /** 文字说明（spinner/pulse 形态） */
  text?: string;
  /** 骨架屏行数（仅 skeleton 形态），默认 3 */
  lineCount?: number;
  /** 容器高度（仅 skeleton），默认 100% */
  height?: number | string;
  /** 是否占满父容器（minHeight + 居中），默认 true */
  fullscreen?: boolean;
  /** 自定义 className */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 子节点（包裹模式：loading=true 时显示 Loading，否则显示 children） */
  children?: ReactNode;
}

const SIZE_MAP: Record<LoadingSize, { icon: number; text: number; gap: number }> = {
  sm: { icon: 14, text: 11, gap: 6 },
  md: { icon: 20, text: 13, gap: 8 },
  lg: { icon: 28, text: 15, gap: 10 },
};

/**
 * S-02：统一的 Loading 组件
 *
 * 用途：替代项目里 20+ 处散落的 `<i className="ti ti-loader-2 ti-spin" />` + 简单居中布局，
 * 让所有加载态视觉一致（spinner 颜色/大小、文字、间距）。
 *
 * 使用示例：
 *   <Loading variant="spinner" text="正在恢复命盘…" />
 *   <Loading variant="skeleton" lineCount={5} />
 *   <Loading fullscreen={false}>{content}</Loading>
 */
export function LoadingSkeleton({
  variant = "spinner",
  size = "md",
  text,
  lineCount = 3,
  height,
  fullscreen = true,
  className,
  style,
  children,
}: LoadingSkeletonProps) {
  // 包裹模式：children 优先
  if (children !== undefined) return <>{children}</>;

  const cfg = SIZE_MAP[size];

  const containerStyle: CSSProperties = {
    ...(fullscreen
      ? {
          minHeight: 240,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: cfg.gap,
          color: "var(--text-muted)",
          padding: "24px 16px",
        }
      : {
          display: "inline-flex",
          alignItems: "center",
          gap: cfg.gap,
          color: "var(--text-muted)",
        }),
    ...style,
  };

  if (variant === "spinner") {
    return (
      <div className={className} style={containerStyle} role="status" aria-live="polite">
        <i
          className="ti ti-loader-2 ti-spin"
          style={{ fontSize: cfg.icon, color: "var(--brand)" }}
          aria-hidden
        />
        {text && (
          <span style={{ fontSize: cfg.text, fontFamily: "var(--font-ui)" }}>{text}</span>
        )}
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={className} style={containerStyle} role="status" aria-live="polite">
        <span
          style={{
            fontSize: cfg.text,
            fontFamily: "var(--font-ui)",
            animation: "zw-pulse 1.4s ease-in-out infinite",
          }}
        >
          {text || "加载中…"}
        </span>
        <style>{`@keyframes zw-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
      </div>
    );
  }

  // skeleton：骨架屏
  const lines = Array.from({ length: lineCount });
  return (
    <div
      className={className}
      style={{
        width: "100%",
        ...(height !== undefined ? { height } : { minHeight: 120 }),
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        ...style,
      }}
      role="status"
      aria-live="polite"
    >
      {lines.map((_, i) => (
        <div
          key={i}
          style={{
            height: i === lines.length - 1 ? 12 : 16,
            width: i === lines.length - 1 ? "60%" : "100%",
            background:
              "linear-gradient(90deg, var(--soft) 0%, var(--line-light) 50%, var(--soft) 100%)",
            backgroundSize: "200% 100%",
            borderRadius: 4,
            animation: "zw-shimmer 1.6s ease-in-out infinite",
          }}
        />
      ))}
      <style>{`@keyframes zw-shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}

/** 简写别名：保持调用简洁 */
export const Loading = LoadingSkeleton;
