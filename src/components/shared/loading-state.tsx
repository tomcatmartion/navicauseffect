/**
 * LoadingState — 页面级加载状态（简洁 API）
 *
 * S-02：统一各页面「加载中」视觉，避免各页自行拼图标/文案。
 *
 * 与 LoadingSkeleton 的分工（视觉一致，互不替代）：
 *   - LoadingState：页面级简洁 API（title + description），适合整页 loading
 *   - LoadingSkeleton：区块级灵活 API（variant=spinner/pulse/skeleton + size + lineCount）
 *
 * 两者底层都用 ti-loader-2 ti-spin + var(--brand) 颜色，视觉完全一致。
 *
 * 使用：
 *   <LoadingState title="加载命盘中…" />
 *   <LoadingState title="加载价格配置" description="请稍候" />
 */

interface LoadingStateProps {
  /** 主文案，默认「加载中…」 */
  title?: string;
  /** 辅助说明 */
  description?: string;
}

export function LoadingState({
  title = "加载中…",
  description,
}: LoadingStateProps) {
  return (
    <div
      className="empty-state"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        color: "var(--text-muted)",
        textAlign: "center",
      }}
    >
      <i
        className="ti ti-loader-2 ti-spin"
        aria-hidden
        style={{ fontSize: 32, color: "var(--brand)", marginBottom: 14 }}
      />
      <h3 style={{ fontSize: 15, color: "var(--ink)", margin: 0 }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0" }}>
          {description}
        </p>
      )}
    </div>
  );
}
