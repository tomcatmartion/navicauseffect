import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTagDefinitions } from "@/lib/logicdoc/registry";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** GET: 获取当前合并后的完整标签定义 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const definitions = await getTagDefinitions();
    return NextResponse.json({ definitions });
  } catch (error) {
    console.error("[tags/definitions] error:", error);
    return NextResponse.json({ definitions: [] });
  }
}
