import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readIndexProgress } from "@/lib/zvec/index-progress";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** GET: 查询向量化进度 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  try {
    const progress = await readIndexProgress();
    return NextResponse.json(progress);
  } catch (error) {
    console.error("[knowledge-base/index-progress] error:", error);
    return NextResponse.json({ status: "idle" }, { status: 500 });
  }
}
