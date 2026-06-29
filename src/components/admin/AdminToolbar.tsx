"use client";

/**
 * 管理后台列表页工具栏
 * 左侧可选搜索框（受控），右侧操作插槽（筛选/导出/新增按钮）
 * 视觉规范来自 ziwei.css 的 .admin-toolbar 类
 */

import type { ReactNode } from "react";

export interface AdminToolbarProps {
  /** 搜索框配置；不传则不渲染搜索框 */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** 按回车时触发 */
    onEnter?: () => void;
  };
  /** 右侧操作区（按钮、筛选、批量操作等） */
  children?: ReactNode;
}

export function AdminToolbar({ search, children }: AdminToolbarProps) {
  return (
    <div className="admin-toolbar">
      {search && (
        <div className="admin-toolbar-search">
          <i className="ti ti-search" />
          <input
            type="text"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.onEnter) {
                search.onEnter();
              }
            }}
            placeholder={search.placeholder ?? "搜索..."}
          />
        </div>
      )}
      {children && <div className="admin-toolbar-actions">{children}</div>}
    </div>
  );
}
