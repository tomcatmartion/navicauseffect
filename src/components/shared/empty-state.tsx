/**
 * EmptyState — 空状态统一组件
 *
 * 提炼自 dual-chat-panel.tsx 与 charts 列表的空态实现。
 * 配合 ziwei.css 中已定义的 .empty-state 类（行 641-644）。
 *
 * 使用：
 *   <EmptyState icon="ti-mood-empty" title="还没有命盘" />
 *   <EmptyState icon="ti-file-text" title="暂无报告" description="选择模板开始生成">
 *     <button className="btn btn-primary">立即创建</button>
 *   </EmptyState>
 */

import { type ReactNode } from "react";

interface EmptyStateProps {
  /** Tabler 图标名（不含 ti 前缀），如 "mood-empty" / "file-text" */
  icon?: string;
  title: string;
  description?: string;
  /** 操作区（按钮等），垂直排列在文字下方 */
  children?: ReactNode;
}

export function EmptyState({
  icon = "mood-empty",
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <i className={`ti ti-${icon}`} aria-hidden />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children && (
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
}
