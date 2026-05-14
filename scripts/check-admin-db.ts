/**
 * 自测：数据库读写 + admin 账号与密码校验
 * 运行: npx tsx scripts/check-admin-db.ts
 *
 * AdminConfig.admin_password_hash 与 User.password 在 seed 中写入同一明文对应的 bcrypt。
 * NextAuth 只读 User.password。本 seed 每次固定写入明文 ffffff 的 bcrypt。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("DATABASE_URL 存在:", !!process.env.DATABASE_URL);
  console.log("");

  // 1. 从 AdminConfig 读取管理员密码哈希
  const pwConfig = await prisma.adminConfig.findUnique({
    where: { configKey: "admin_password_hash" },
  });
  if (!pwConfig || typeof pwConfig.configValue !== "string") {
    console.log("❌ AdminConfig 中未找到 admin_password_hash，请先运行 npm run db:seed");
    return;
  }
  const storedHash = pwConfig.configValue as string;
  console.log("✅ 从 AdminConfig 读取到 admin_password_hash");

  // 2. 用环境变量或默认值验证密码匹配
  const testPassword = "ffffff";
  const match = await bcrypt.compare(testPassword, storedHash);
  console.log(`  bcrypt.compare('${testPassword}', hash):`, match ? "✅ 匹配" : "❌ 不匹配");
  console.log("");

  // 3. 检查 admin 用户
  const admin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!admin) {
    console.log("❌ 未找到 username=admin 的用户");
    const byInvite = await prisma.user.findFirst({ where: { inviteCode: "ADMIN001" } });
    const byRole = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    console.log("  inviteCode=ADMIN001:", byInvite?.id ?? "无");
    console.log("  role=ADMIN:", byRole?.id ?? "无");
    return;
  }
  console.log("✅ 找到 admin 用户:", admin.id, "nickname:", admin.nickname);

  // 4. 验证用户表中的密码与 AdminConfig 一致
  const userPwMatch = admin.password && (await bcrypt.compare(testPassword, admin.password));
  console.log("  用户表密码校验:", userPwMatch ? "✅ 匹配" : "❌ 不匹配");
}

main()
  .catch((e) => {
    console.error("错误:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
