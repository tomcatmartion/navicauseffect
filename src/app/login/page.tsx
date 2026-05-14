import { redirect } from "next/navigation";

/** 兼容旧链接与外链 `/login`，实际登录页为 `/auth/login`。 */
export default function LegacyLoginRedirectPage() {
  redirect("/auth/login");
}
