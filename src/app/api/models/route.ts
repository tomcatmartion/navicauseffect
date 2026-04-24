import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const models = await prisma.aIModelConfig.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      provider: true,
      isDefault: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(models);
}
