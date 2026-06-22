import { redirect } from "next/navigation";

/**
 * /share → /promoter 永久重定向
 *
 * 原 /share 的功能（分享渠道、邀请码、奖励规则）已合并到 /promoter。
 * rail 第 7 项「推广」指向 /promoter；老链接通过本文件 308 跳转。
 */
export default function SharePage() {
  redirect("/promoter");
}
