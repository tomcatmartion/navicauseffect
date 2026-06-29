/**
 * 管理后台卡片
 * 带可选 head（图标+标题+描述+操作）+ body 插槽
 * 视觉规范来自 ziwei.css 的 .admin-card 类
 */

import type { CSSProperties, ReactNode } from "react";

export interface AdminCardProps {
  /** 头部图标类名（与 title/desc 任一同时存在时渲染 head） */
  icon?: string;
  /** 头部图标颜色（覆盖默认 var(--brand)，用于第三方品牌识别色如微信绿/支付宝蓝） */
  iconColor?: string;
  /** 头部标题 */
  title?: string;
  /** 头部描述文案 */
  desc?: string;
  /** 头部右侧操作区（按钮、状态徽章等） */
  headActions?: ReactNode;
  /** 卡片主体 */
  children: ReactNode;
  /** 自定义 className（用于覆盖 padding 等） */
  className?: string;
  /** 内联样式透传（如 margin-bottom 控制卡片间距） */
  style?: CSSProperties;
}

export function AdminCard({
  icon,
  iconColor,
  title,
  desc,
  headActions,
  children,
  className,
  style,
}: AdminCardProps) {
  const hasHead = icon || title || desc || headActions;
  return (
    <div className={`admin-card${className ? ` ${className}` : ""}`} style={style}>
      {hasHead && (
        <div className="admin-card-head">
          <div className="admin-card-head-left">
            {icon && (
              <div
                className="admin-card-head-icon"
                style={iconColor ? { color: iconColor, borderColor: iconColor } : undefined}
              >
                <i className={`ti ${icon}`} />
              </div>
            )}
            {(title || desc) && (
              <div className="admin-card-head-text">
                {title && <div className="admin-card-title">{title}</div>}
                {desc && <div className="admin-card-desc">{desc}</div>}
              </div>
            )}
          </div>
          {headActions && (
            <div className="admin-card-actions">{headActions}</div>
          )}
        </div>
      )}
      <div className="admin-card-body">{children}</div>
    </div>
  );
}
