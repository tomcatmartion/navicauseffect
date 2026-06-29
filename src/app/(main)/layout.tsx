import { Rail } from "@/components/layout/rail";
import { Topbar } from "@/components/layout/topbar";
import { MobileTabbar } from "@/components/layout/mobile-tabbar";
import { Footer } from "@/components/layout/footer";

/**
 * (main) 路由组的根布局。
 *
 * DOM 与 testUI/desktop/*.html 的 <div class="app"> 结构对齐：
 *   <div class="app">
 *     <Rail />                 (hidden md:flex)
 *     <div class="main">
 *       <Topbar />
 *       <div class="content">{children}<Footer/></div>
 *     </div>
 *     <MobileTabbar />         (flex md:hidden，H5 底部 5 项)
 *   </div>
 *
 * ThemeSwitcher 已移至 root layout 全局挂载（右上角，覆盖登录页/admin/主站）。
 * Footer 放在滚动区底部（不是 fixed），桌面端显示，移动端由 MobileTabbar 占据。
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
            现阶段（业务页尚未全部重构）需要让长列表页可垂直滚动，故用 overflow-y-auto。
            padding-bottom 给桌面端 fixed footer 让位（footer 约 60px，留 80px 缓冲）。
            移动端不需要（由 mobile-tabbar 占据，tabbar 是 absolute 不抢滚动空间）。 */}
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "80px" }}>
          {children}
          <Footer />
        </div>
      </div>
      <MobileTabbar />
    </div>
  );
}
