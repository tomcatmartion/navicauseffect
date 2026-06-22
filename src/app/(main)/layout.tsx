import { Rail } from "@/components/layout/rail";
import { Topbar } from "@/components/layout/topbar";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";

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
 *     <MobileNav />            (md:hidden, 阶段 5 改造为 testUI tabbar)
 *   </div>
 *
 * 注：未引入 Suspense fallback 因为 Rail/Topbar/ThemeSwitcher 都是轻量客户端组件，
 * 没有异步依赖；HeaderFallback 已不需要。
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
      <MobileNav />
    </div>
  );
}
