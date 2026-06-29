"use client";

import type { CSSProperties } from "react";

interface ErrorRetryCardProps {
  /** 错误标题，例如「网络错误」「服务异常」 */
  title: string;
  /** 详细说明，例如「请检查网络连接后重试」 */
  detail?: string;
  /** 错误码 / HTTP 状态，例如「500」「NETWORK_ERROR」 */
  code?: string | number;
  /** 点击重试回调；不传则不显示按钮（仅展示错误） */
  onRetry?: () => void;
  /** 是否正在重试中（按钮 loading） */
  retrying?: boolean;
  /** 自定义样式（外层） */
  style?: CSSProperties;
}

/**
 * O-09：统一的错误恢复 Card
 *
 * 用途：在消息列表 / 报告页 / 合盘页等服务端调用失败的位置，
 * 用结构化错误卡片替代「[错误] xxx」纯文本，提供「重试」CTA，
 * 减少用户在 500 / 网络错误场景下的死胡同。
 */
export function ErrorRetryCard({
  title,
  detail,
  code,
  onRetry,
  retrying = false,
  style,
}: ErrorRetryCardProps) {
  return (
    <div
      className="card"
      style={{
        margin: "8px 0",
        padding: 14,
        background: "var(--danger-soft, rgba(180, 40, 40, 0.06))",
        borderColor: "var(--danger)",
        borderRadius: "var(--radius-sm, 6px)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <i
          className="ti ti-alert-triangle"
          style={{ color: "var(--danger)", fontSize: 18 }}
          aria-hidden
        />
        <strong style={{ color: "var(--danger)", fontSize: 13 }}>{title}</strong>
        {code !== undefined && code !== "" && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              padding: "1px 6px",
              background: "var(--soft)",
              color: "var(--text-muted)",
              borderRadius: 3,
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {String(code)}
          </span>
        )}
      </div>
      {detail && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          {detail}
        </p>
      )}
      {onRetry && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onRetry}
            disabled={retrying}
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            {retrying ? (
              <>
                <i className="ti ti-loader-2 ti-spin" /> 重试中…
              </>
            ) : (
              <>
                <i className="ti ti-refresh" /> 重新尝试
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
