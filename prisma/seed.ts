import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  /** 与表初始化一致：固定管理员账号（勿依赖环境变量） */
  const adminUsername = "admin";
  const adminPlainPassword = "ffffff";
  const hashedPassword = await bcrypt.hash(adminPlainPassword, 10);

  // 与 User.password 同步一份到 AdminConfig（其它脚本可读）
  await prisma.adminConfig.upsert({
    where: { configKey: "admin_password_hash" },
    update: { configValue: hashedPassword },
    create: { configKey: "admin_password_hash", configValue: hashedPassword },
  });
  console.log("管理员密码哈希已写入 AdminConfig（与 users.password 一致）");

  let existing = await prisma.user.findUnique({ where: { username: adminUsername } });

  if (!existing) {
    existing = await prisma.user.findUnique({ where: { email: "admin@navicause.com" } });
  }
  if (!existing) {
    existing = await prisma.user.findUnique({ where: { inviteCode: "ADMIN001" } });
  }

  const adminUserData = {
    username: adminUsername,
    password: hashedPassword,
    nickname: "管理员",
    role: "ADMIN" as const,
    inviteCode: "ADMIN001",
    membership: {
      upsert: {
        create: { plan: "YEARLY" as const, status: "ACTIVE" as const },
        update: { plan: "YEARLY" as const, status: "ACTIVE" as const },
      },
    },
  };

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: adminUserData.username,
        password: adminUserData.password,
        nickname: adminUserData.nickname,
        role: adminUserData.role,
        inviteCode: adminUserData.inviteCode,
        membership: adminUserData.membership,
      },
    });
    console.log("管理员已初始化/更新: admin / ffffff · ADMIN · 年度会员 ACTIVE");
  } else {
    const admin = await prisma.user.create({
      data: {
        username: adminUserData.username,
        password: adminUserData.password,
        nickname: adminUserData.nickname,
        role: adminUserData.role,
        inviteCode: adminUserData.inviteCode,
        membership: { create: { plan: "YEARLY", status: "ACTIVE" } },
      },
    });
    console.log("管理员已创建: admin / ffffff · ADMIN · 年度会员 ACTIVE");
    console.log(`  user id: ${admin.id}`);
  }

  const plans = [
    { plan: "MONTHLY" as const, originalPrice: 10 },
    { plan: "QUARTERLY" as const, originalPrice: 25 },
    { plan: "YEARLY" as const, originalPrice: 99 },
  ];

  for (const p of plans) {
    await prisma.membershipPricing.upsert({
      where: { id: `seed-${p.plan.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-${p.plan.toLowerCase()}`,
        plan: p.plan,
        originalPrice: p.originalPrice,
        isActive: true,
      },
    });
  }
  console.log("会员价格初始化完成（包月10/包季25/包年99）");

  await prisma.adminConfig.upsert({
    where: { configKey: "per_query_price" },
    update: {},
    create: { configKey: "per_query_price", configValue: 0.5 },
  });
  console.log("按次付费价格初始化完成（0.5元/次）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
