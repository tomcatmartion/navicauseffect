/**
 * 管理后台空状态
 * 用于无数据/无搜索结果场景
 * 视觉规范来自 ziwei.css 的 .admin-empty 类
 */

import type { ReactNode } from "react";

export interface AdminEmptyStateProps {
  /** Tabler Icons 图标类名 */
  icon: string;
  /** 主标题 */
  title: string;
  /** 描述文案（可选） */
  desc?: string;
  /** 底部操作区（按钮等，可选） */
  children?: ReactNode;
}

export function AdminEmptyState({
  icon,
  title,
  desc,
  children,
}: AdminEmptyStateProps) {
  return (
    <div className="admin-empty">
      <i className={`ti ${icon}`} />
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
      {children}
    </div>
  );
}
