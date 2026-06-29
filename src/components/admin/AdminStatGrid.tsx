/**
 * 管理后台统计卡网格容器
 * 自适应列数（minmax(220px, 1fr)），移动端降级到 2 列或 1 列
 */

import type { ReactNode } from "react";

export interface AdminStatGridProps {
  children: ReactNode;
}

export function AdminStatGrid({ children }: AdminStatGridProps) {
  return <div className="admin-stat-grid">{children}</div>;
}
