import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readRetagProgress } from "@/lib/logicdoc/retag-progress";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** GET: 获取打标任务进度 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const progress = await readRetagProgress();
  return NextResponse.json(progress);
}
