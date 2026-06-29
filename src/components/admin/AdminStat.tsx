/**
 * 管理后台数据统计卡
 * 用于仪表盘、统计页等场景的关键指标展示
 * 视觉规范来自 ziwei.css 的 .admin-stat 类
 */

import type { ReactNode } from "react";

export interface AdminStatProps {
  /** Tabler Icons 图标类名，如 "ti-users" */
  icon: string;
  /** 指标名称 */
  label: string;
  /** 指标数值（字符串或数字皆可，便于直接渲染金额/百分比） */
  value: string | number;
  /** 底部辅助文案（可选，如 "较昨日 +5"） */
  sub?: ReactNode;
  /** 辅助文案的趋势色（可选，影响文案颜色） */
  trend?: "up" | "down";
}

export function AdminStat({
  icon,
  label,
  value,
  sub,
  trend,
}: AdminStatProps) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-head">
        <span className="admin-stat-label">{label}</span>
        <div className="admin-stat-icon">
          <i className={`ti ${icon}`} />
        </div>
      </div>
      <div className="admin-stat-value">{value}</div>
      {sub && (
        <div className={`admin-stat-sub${trend ? ` ${trend}` : ""}`}>{sub}</div>
      )}
    </div>
  );
}
