import { Rail } from "@/components/layout/rail";
import { Topbar } from "@/components/layout/topbar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { MobileTabbar } from "@/components/layout/mobile-tabbar";

/**
 * (main) 路由组的根布局。
 *
 * DOM 与 testUI/desktop/*.html 的 <div class="app"> 结构对齐：
 *   <div class="app">
 *     <Rail />                 (hidden md:flex)
 *     <div class="main">
 *       <Topbar />
 *       <div class="content">{children}</div>
 *     </div>
 *     <ThemeSwitcher />        (右下角悬浮)
 *     <MobileTabbar />         (flex md:hidden，H5 底部 5 项)
 *   </div>
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app">
      <Rail />
      <div className="main">
        <Topbar />
        {/* 内容滚动容器：testUI 原本 .view.overflow:hidden 是 SPA 内嵌滚动设计，
            现阶段（业务页尚未全部重构）需要让长列表页可垂直滚动，故用 overflow-y-auto */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
      <ThemeSwitcher />
      <MobileTabbar />
    </div>
  );
}
