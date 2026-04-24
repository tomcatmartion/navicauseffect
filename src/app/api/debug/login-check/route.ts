/**
 * 仅用于自测登录逻辑：用与 auth 相同的 prisma + bcrypt 校验用户名密码。
 * 仅在 NODE_ENV=development 时可用。
 * 用法: POST /api/debug/login-check  body: JSON.stringify({ username: "admin", password: "<your_password>" })
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  try {
    const body = await request.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "").trim();

    const user = await prisma.user.findUnique({ where: { username } });
    const userFound = !!user;
    const hasPassword = !!user?.password;
    const passwordMatch =
      hasPassword && (await bcrypt.compare(password, user!.password!));

    return NextResponse.json({
      ok: userFound && passwordMatch,
      userFound,
      hasPassword,
      passwordMatch,
      userId: user?.id ?? null,
      message:
        userFound && passwordMatch
          ? "校验通过，应能登录"
          : !userFound
            ? "未找到该用户"
            : !hasPassword
              ? "用户无密码"
              : "密码不匹配",
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), ok: false },
      { status: 500 }
    );
  }
}
