import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "用户名长度需要3-20个字符" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "用户名只能包含字母、数字和下划线" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "密码至少6位" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "该用户名已被注册" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    let inviteCode = generateInviteCode();
    const maxInviteRetries = 5;

    for (let attempt = 0; attempt < maxInviteRetries; attempt++) {
      try {
        const user = await prisma.user.create({
          data: {
            username,
            password: hashedPassword,
            nickname: nickname || username,
            inviteCode,
            membership: { create: { plan: "FREE", status: "ACTIVE" } },
          },
        });
        return NextResponse.json({
          message: "注册成功",
          userId: user.id,
        });
      } catch (err: unknown) {
        const prismaError = err as { code?: string; meta?: { target?: string[] } };
        if (prismaError?.code === "P2002" && prismaError?.meta?.target?.includes("invite_code")) {
          inviteCode = generateInviteCode();
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);

    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError?.code === "P2002") {
      const target = prismaError.meta?.target as string[] | undefined;
      if (target?.includes("username")) {
        return NextResponse.json(
          { error: "该用户名已被注册" },
          { status: 409 }
        );
      }
    }

    const message = process.env.NODE_ENV === "development" && error instanceof Error
      ? error.message
      : "注册失败，请稍后重试";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
