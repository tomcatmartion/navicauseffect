/**
 * 邀请码生成工具
 *
 * 抽取自 src/lib/auth/index.ts、src/app/api/auth/register/route.ts、
 * src/app/api/auth/wechat-miniprogram/route.ts 三处重复实现。
 *
 * 字符集刻意去除易混淆字符（0/O/1/I）。
 */

import { prisma } from "@/lib/db";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_RETRY = 10;

/** 生成一个 8 位邀请码（不保证唯一） */
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/** 生成保证唯一的邀请码（数据库校验，最多重试 10 次） */
export async function generateUniqueInviteCode(): Promise<string> {
  for (let i = 0; i < MAX_RETRY; i++) {
    const code = generateInviteCode();
    const exists = await prisma.user.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error(`生成邀请码失败（${MAX_RETRY} 次重试均冲突）`);
}
