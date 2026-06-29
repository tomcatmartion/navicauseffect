"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  // 三主题（newspaper/clay/neumorphism）均为浅色基调，Sonner 固定 light。
  // 颜色由 --popover / --border / --radius 等 CSS 变量自动跟随主题。
  // 注：sonner 自身在 SSR 时不输出 DOM，仅在客户端 hydration 后挂载 portal，
  // 因此不会引发 hydration mismatch。原先的 mounted 守卫会让首帧 toast 早夭
  //（page 的 useEffect 先于守卫解开，toast 被加入 store 但显示时间不足），故移除。
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
