/**
 * 管理后台页面标题区
 * 统一布局：图标容器 + H2 标题 + 描述文案 + 右侧操作区
 * 视觉规范来自 ziwei.css 的 .admin-page-header 类
 */

import type { ReactNode } from "react";

export interface AdminPageHeaderProps {
  /** Tabler Icons 图标类名，如 "ti-dashboard" */
  icon: string;
  /** 页面主标题 */
  title: string;
  /** 标题下方的描述文案（可选） */
  desc?: string;
  /** 右侧操作区（按钮、状态徽章等） */
  actions?: ReactNode;
}

export function AdminPageHeader({
  icon,
  title,
  desc,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="admin-page-header">
      <div className="admin-page-header-left">
        <div className="admin-page-header-icon">
          <i className={`ti ${icon}`} />
        </div>
        <div>
          <h2 className="admin-page-header-title">{title}</h2>
          {desc && <p className="admin-page-header-desc">{desc}</p>}
        </div>
      </div>
      {actions && (
        <div className="admin-page-header-actions">{actions}</div>
      )}
    </div>
  );
}
