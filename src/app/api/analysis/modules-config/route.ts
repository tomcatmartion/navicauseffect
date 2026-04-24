import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVipCategories } from "@/lib/analysis-archive";

/** 供前端展示「VIP探真」角标及权限提示用，无需鉴权 */
export async function GET() {
  try {
    const vipCategories = await getVipCategories(prisma);
    return NextResponse.json({ vipCategories });
  } catch (error) {
    console.error("modules-config error:", error);
    return NextResponse.json(
      { error: "获取配置失败" },
      { status: 500 }
    );
  }
}
