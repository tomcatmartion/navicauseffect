"use client";

import { usePathname } from "next/navigation";

/**
 * Main 区顶部 64px Topbar。
 * 左侧按路由动态显示页面标题。右侧 .topbar-actions 预留：
 *  - 星币余额（coin-badge）：阶段 4 引入 useUserProfile 后接入
 *  - 命主切换器（identity-switcher）：阶段 2 /chart 内部渲染
 *  - 命盘抽屉开关（chart-toggle）：阶段 2 /chart 内部渲染
 *
 * 本组件目前只承担基础标题显示。testUI 的 topbar-actions 在各业务页内填入。
 */

interface TopbarConfig {
  title: string;
  icon: string;
  sub?: string;
}

function resolveTopbarConfig(pathname: string): TopbarConfig {
  if (pathname === "/") return { title: "紫微问道", icon: "ti-home" };
  if (pathname === "/chart" || pathname.startsWith("/chart?")) {
    return { title: "AI 对话", icon: "ti-message-2", sub: "命盘工作台" };
  }
  if (pathname.startsWith("/chart")) {
    return { title: "AI 对话", icon: "ti-message-2", sub: "命盘工作台" };
  }
  if (pathname.startsWith("/charts")) {
    return { title: "我的命盘", icon: "ti-clipboard-list" };
  }
  if (pathname.startsWith("/reports")) {
    return { title: "命理报告", icon: "ti-file-text" };
  }
  if (pathname.startsWith("/compatibility")) {
    return { title: "双人合盘", icon: "ti-hearts" };
  }
  if (pathname.startsWith("/pricing")) {
    return { title: "会员充值", icon: "ti-crown" };
  }
  if (pathname.startsWith("/profile")) {
    return { title: "个人中心", icon: "ti-user" };
  }
  if (pathname.startsWith("/share")) {
    return { title: "分享中心", icon: "ti-share-3" };
  }
  return { title: "紫微问道", icon: "ti-home" };
}

export function Topbar() {
  const pathname = usePathname();
  const config = resolveTopbarConfig(pathname);

  return (
    <header className="topbar" role="banner">
      <div className="topbar-title">
        <i className={`ti ${config.icon}`} />
        <span>{config.title}</span>
        {config.sub && <span className="topbar-sub">{config.sub}</span>}
      </div>
      <div className="topbar-actions" />
    </header>
  );
}

